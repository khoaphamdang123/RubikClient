import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import axios, { AxiosError } from 'axios';
import { environment } from '../../../environments/environment';
import { PopupService } from '../../../services/popup.service';
import { HeaderComponent } from '../../shared/layouts/header/header.component';
import { Subscription,timer } from 'rxjs';
import { Router } from '@angular/router';
import { ICapcha } from '../../models/capcha.model';
import { HandleService } from '../../../services/handle.service';
import { SesService } from '../../../services/ses.service';
import { ForgotPasswordFormComponent } from '../forgot-password-form/forgot-password-form.component';
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule,HeaderComponent,ForgotPasswordFormComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  providers: [PopupService]
})
export class LoginComponent implements OnInit,OnDestroy {
      loginForm!:FormGroup;
      loginRetryTime:number=0;
      timerSubcribe!:Subscription;
      lockedTime!:Date;
      remainingTime!:number;
      isLocked:boolean=false;
      capcha!:ICapcha;
      standard_remaing_time:string='';
      is_valid_capcha:boolean=true;
      show_form:boolean = false;
      @ViewChild('capchaInput') capchaInput!:ElementRef;
      
      // Rubik's cube colors
      cubeColors: string[] = ['#00d800', '#0051ff', '#ffffff', '#ffe600', '#ff8c00', '#ff0000'];

     constructor(private fb:FormBuilder,private popupService:PopupService,private handleService:HandleService,private router:Router,private sesService:SesService)
      {
      }
       ngOnInit(): void {
        this.capcha=this.generateCapchaForm();
        
        // Initialize random cube colors
        this.initializeCubeColors();
        
        this.loginForm = this.fb.group(
          {
            username:new FormControl('',[Validators.required]),
            password:new FormControl('',[Validators.required])
          });
          this.timerSubcribe=timer(0,1000).subscribe(()=>{
          const current_time=new Date(Date.now());
           if(this.isLocked)
           {
                this.remainingTime=Math.ceil((this.lockedTime.getTime()-current_time.getTime())/1000);
                var second_remain=(this.remainingTime%60)<10?'0'+(this.remainingTime%60):(this.remainingTime%60);
                if(this.remainingTime<60)
                { 
                  this.standard_remaing_time=`00:${second_remain}`;
                }
                else
                {
                  this.standard_remaing_time=`${Math.floor(this.remainingTime/60)}:${second_remain}`;
                }
                if(this.remainingTime<0)
                { 
                  this.remainingTime=0;
                  this.isLocked=false;
                  this.loginRetryTime=0;
                }
           }  
          });
      }

      ngOnDestroy(): void {
        if(this.timerSubcribe)
        { 
          this.timerSubcribe.unsubscribe();
        }
      }
     

    showForm()
    {
      this.show_form=true;
    }

    closeForm()
    {
      this.show_form = false;
    }

      generateCapchaForm():ICapcha
      {
      var operators =['+','-','*'];
      var first_number=Math.floor(Math.random()*(100-1)+1);
      var second_number=Math.floor(Math.random()*(100-1)+1);
      var operator = operators[Math.floor(Math.random()*operators.length)];
      var prob=`${first_number} ${operator} ${second_number}`;
      var result=eval(prob);
      var gen_capcha:ICapcha={first_number:first_number,result_number:result,operator:operator,second_number:second_number};
      return gen_capcha;
      }

      refreshCapcha():void
      {
        this.capcha=this.generateCapchaForm();
      }

      // Initialize solid colors for cube faces (like a solved Rubik's cube)
      // Each cube gets vivid, distinct colors for all 6 faces
      initializeCubeColors(): void {
        setTimeout(() => {
          const cubes = document.querySelectorAll('.rubiks-cube');
          
          cubes.forEach((cube) => {
            const faces = cube.querySelectorAll('.rubiks-face');
            
            // Official Rubik's Cube colors (Pantone standards)
            // The order MUST match HTML order: front, back, top, bottom, left, right
            const faceColors = [
              '#0051BA',  // Face 0 (.front) - Blue (Pantone 293C)
              '#C41E3A',  // Face 1 (.back) - Red (Pantone 186C)  
              '#FFFFFF',  // Face 2 (.top) - White
              '#FFD500',  // Face 3 (.bottom) - Yellow (Pantone 012C)
              '#009E60',  // Face 4 (.left) - Green (Pantone 347C)
              '#FF5800'   // Face 5 (.right) - Orange (Pantone 021C)
            ];
            
            faces.forEach((face, faceIndex) => {
              const color = faceColors[faceIndex];
              const blocks = face.querySelectorAll('.block');
              
              // Set all 9 blocks on this face to the same color
              blocks.forEach((block: Element) => {
                (block as HTMLElement).style.backgroundColor = color;
                // Also add important flag to ensure it overrides any other styles
                (block as HTMLElement).style.setProperty('background-color', color, 'important');
              });
            });
          });
        }, 100); // Small delay to ensure DOM is ready
      }

      async onSubmitForm()
      { 
        if(!this.loginForm.valid)
        {
          this.loginForm.markAllAsTouched();
        }
        else
        {       
        try
        {
          const capcha_input_value=this.capchaInput.nativeElement.value;
         if(parseInt(capcha_input_value)!=this.capcha.second_number)
          {
           this.is_valid_capcha=false;
           this.capcha = this.generateCapchaForm();
           return;
          }
          else
          {
          this.is_valid_capcha=true;
          }
          var ip_addr='';
          var city = '';
          await axios.get('https://api.db-ip.com/v2/free/self').then((res)=>{
            ip_addr= res.data.ipAddress;
            city = res.data.city;
          });
          
          this.loginForm.addControl('ip_addr',new FormControl(ip_addr));
          this.loginForm.addControl('city',new FormControl(city));
          await axios.post(`${environment.server_url}/login`,this.loginForm.value).then(async(res)=>{
          if(this.isLocked)
          { 
           this.popupService.AlertErrorDialog(`You have been locked from logging in ${this.standard_remaing_time}`,"Login Blocked");
          }
          else
          {
          var user=res.data.data;
          localStorage.setItem("TOKEN",res.data.token);
          localStorage.setItem("AVATAR",user.avatar);
          localStorage.setItem("ACCOUNT",JSON.stringify(user));
          this.router.navigate(['/about']);
          }
          }).catch((err)=>{
              if(err!=null)
              {  
               if(!this.isLocked)
               {
                this.loginRetryTime+=1;
               } 
                if(this.isLocked)
                 {
                  this.popupService.AlertErrorDialog(`You have been locked from logging in ${this.standard_remaing_time}`,"Login Blocked");               
                 }
                
                if(this.loginRetryTime>5)
                { if(!this.isLocked)
                  {
                  this.lockedTime=new Date(Date.now()+2*60*1000);
                  this.isLocked=true;
                  this.popupService.AlertErrorDialog(`You have been locked from logging in 2 minutes`,"Login Blocked");
                  }
                }
                else
                {
                if(err.response?.status===401)
                { 
                  this.capcha = this.generateCapchaForm();
                  this.popupService.AlertErrorDialog(err.response.data.message,"Login Error");                 
                }
              }
              }
          });
        }
        catch(error)
        {
          console.log(error);
        }
        }
      }
}
