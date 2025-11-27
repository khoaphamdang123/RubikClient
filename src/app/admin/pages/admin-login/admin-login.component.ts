import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import axios, { AxiosError } from 'axios';
import { environment } from '../../../../environments/environment';
import { PopupService } from '../../../../services/popup.service';
import { Subscription, timer } from 'rxjs';
import { Router } from '@angular/router';
import { ICapcha } from '../../../models/capcha.model';
import { HandleService } from '../../../../services/handle.service';
import { SesService } from '../../../../services/ses.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './admin-login.component.html',
  styleUrl: './admin-login.component.scss',
  providers: [PopupService]
})
export class AdminLoginComponent implements OnInit, OnDestroy {
  loginForm!: FormGroup;
  loginRetryTime: number = 0;
  timerSubcribe!: Subscription;
  lockedTime!: Date;
  remainingTime!: number;
  isLocked: boolean = false;
  capcha!: ICapcha;
  standard_remaing_time: string = '';
  is_valid_capcha: boolean = true;
  isLoading: boolean = false;
  passwordVisible:boolean=false;
  @ViewChild('capchaInput') capchaInput!: ElementRef;

  constructor(
    private fb: FormBuilder,
    private popupService: PopupService,
    private handleService: HandleService,
    private router: Router,
    private sesService: SesService
  ) {}

  ngOnInit(): void {
    // Check if already logged in as admin
    const token = localStorage.getItem('TOKEN');
    const account = localStorage.getItem('ACCOUNT');
    if (token && account) {
      try {
        const user = JSON.parse(account);
        // Check if user is admin (support both role_id and role string)
        if (user.role_id === 1 || user.role === 'Admin') {
          this.router.navigate(['/admin/dashboard']);
          return;
        }
      } catch (e) {
        // Invalid account data, continue with login
      }
    }

    this.capcha = this.generateCapchaForm();

    this.loginForm = this.fb.group({
      username: new FormControl('', [Validators.required]),
      password: new FormControl('', [Validators.required])
    });

    this.timerSubcribe = timer(0, 1000).subscribe(() => {
      const current_time = new Date(Date.now());
      if (this.isLocked) {
        this.remainingTime = Math.ceil((this.lockedTime.getTime() - current_time.getTime()) / 1000);
        var second_remain = (this.remainingTime % 60) < 10 ? '0' + (this.remainingTime % 60) : (this.remainingTime % 60);
        if (this.remainingTime < 60) {
          this.standard_remaing_time = `00:${second_remain}`;
        } else {
          this.standard_remaing_time = `${Math.floor(this.remainingTime / 60)}:${second_remain}`;
        }
        if (this.remainingTime < 0) {
          this.remainingTime = 0;
          this.isLocked = false;
          this.loginRetryTime = 0;
        }
      }
    });
  }

  ngOnDestroy(): void {
    if (this.timerSubcribe) {
      this.timerSubcribe.unsubscribe();
    }
  }

  generateCapchaForm(): ICapcha {
    const generators = [this.generateArithmeticChallenge, this.generateIntegralChallenge, this.generateDerivativeChallenge];
    const picked = generators[Math.floor(Math.random() * generators.length)].bind(this);
    return picked();
  }

  refreshCapcha(): void {
    this.capcha = this.generateCapchaForm();
    if (this.capchaInput) {
      this.capchaInput.nativeElement.value = '';
    }
  }

  togglePasswordVisibility():void{
    this.passwordVisible = !this.passwordVisible;
  }

  async onSubmitForm() {
    if (!this.loginForm.valid) {
      this.loginForm.markAllAsTouched();
      alert(localStorage.getItem('TOKEN'));
      return;
    }

    try {
      const capcha_input_value = this.capchaInput.nativeElement.value;
      const parsedAnswer = Number(capcha_input_value);
      if (!Number.isFinite(parsedAnswer) || Math.abs(parsedAnswer - this.capcha.answer) > 0.0001) {
        this.is_valid_capcha = false;
        this.capcha = this.generateCapchaForm();
        this.capchaInput.nativeElement.value = '';
        return;
      } else {
        this.is_valid_capcha = true;
      }

      this.isLoading = true;

      var ip_addr = '';
      var city = '';
      try {
        await axios.get('https://api.db-ip.com/v2/free/self').then((res) => {
          ip_addr = res.data.ipAddress;
          city = res.data.city;
        });
      } catch (e) {
        // If IP detection fails, continue without it
      }

      this.loginForm.addControl('ip_addr', new FormControl(ip_addr));

      this.loginForm.addControl('city', new FormControl(city));

      await axios.post(`${environment.server_url}/admin/login`, this.loginForm.value).then(async (res) => {
        if (this.isLocked) {
          this.popupService.AlertErrorDialog(`You have been locked from logging in ${this.standard_remaing_time}`, "Login Blocked");
          this.isLoading = false;
        } else {
          // Check response status
          if (!res.data.status) {
            this.popupService.AlertErrorDialog(res.data.message || "Login failed", "Login Error");
            this.isLoading = false;
            this.capcha = this.generateCapchaForm();
            this.capchaInput.nativeElement.value = '';
            return;
          }

          var userData = res.data.data;
          
          // Verify admin role (server already checks, but double-check for safety)
          if (userData.role !== 'Admin') {
            this.popupService.AlertErrorDialog("Access denied. Admin privileges required.", "Unauthorized");
            this.isLoading = false;
            this.capcha = this.generateCapchaForm();
            this.capchaInput.nativeElement.value = '';
            return;
          }

          // Store token and user data
          const token = res?.data?.token ?? res?.data?.data?.token ?? '';
          if (!token) {
            this.popupService.AlertErrorDialog("Login succeeded but no token was returned by server.", "Login Error");
            this.isLoading = false;
            return;
          }
          localStorage.setItem("TOKEN", token);
          localStorage.setItem("AVATAR", (res.data.avatar ?? userData.avatar) || '');
          
          // Store user account data with role_id for compatibility
          const accountData = {
            id: userData.id,
            username: userData.username,
            email: userData.email,
            role: userData.role,
            role_id: 1 // Admin role_id is 1
          };
          localStorage.setItem("ACCOUNT", JSON.stringify(accountData));
          
          // Redirect to admin dashboard
          this.router.navigate(['/admin/dashboard']);
        }
      }).catch((err) => {
        this.isLoading = false;
        if (err != null) {
          if (!this.isLocked) {
            this.loginRetryTime += 1;
          }
          if (this.isLocked) {
            this.popupService.AlertErrorDialog(`You have been locked from logging in ${this.standard_remaing_time}`, "Login Blocked");
          }

          if (this.loginRetryTime > 5) {
            if (!this.isLocked) {
              this.lockedTime = new Date(Date.now() + 2 * 60 * 1000);
              this.isLocked = true;
              this.popupService.AlertErrorDialog(`You have been locked from logging in 2 minutes`, "Login Blocked");
            }
          } else {
            // Handle different error status codes
            if (err.response?.status === 400 || err.response?.status === 401 || err.response?.status === 403) {
              this.capcha = this.generateCapchaForm();
              this.capchaInput.nativeElement.value = '';
              const errorMessage = err.response?.data?.message || "Login failed. Please check your credentials.";
              this.popupService.AlertErrorDialog(errorMessage, "Login Error");
            } else if (err.response?.status === 500) {
              this.popupService.AlertErrorDialog("Server error. Please try again later.", "Server Error");
            }
          }
        }
      });
    } catch (error) {
      this.isLoading = false;
      console.log(error);
    }
  }

  navigateToClientLogin() {
    this.router.navigate(['/admin/login']);
  }

  private generateArithmeticChallenge(): ICapcha {
    const a = this.randomInt(8, 25);
    const b = this.randomInt(3, 15);
    const c = this.randomInt(2, 9);
    const expression = `(${a} + ${b}) × ${c}`;
    return {
      prompt: `${expression} = ?`,
      answer: (a + b) * c
    };
  }

  private generateIntegralChallenge(): ICapcha {
    const power = this.randomInt(1, 3);
    const upper = this.randomInt(1, 3);
    const base = this.randomInt(1, 5);
    const coefficient = base * (power + 1);
    const answer = base * Math.pow(upper, power + 1);
    const term = power === 1 ? `${coefficient}x` : `${coefficient}x^${power}`;
    return {
      prompt: `∫₀^${upper} ${term} dx`,
      answer
    };
  }

  private generateDerivativeChallenge(): ICapcha {
    const power = this.randomInt(2, 4);
    const coefficient = this.randomInt(2, 6);
    const point = this.randomInt(1, 4);
    const answer = coefficient * power * Math.pow(point, power - 1);
    return {
      prompt: `d/dx (${coefficient}x^${power}) at x = ${point}`,
      answer
    };
  }

  private randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

