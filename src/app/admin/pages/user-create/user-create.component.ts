import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { Router } from '@angular/router';
import axios from 'axios';
import { environment } from '../../../../environments/environment';
import { PopupService } from '../../../../services/popup.service';

interface CreateUserResponse {
  status: boolean;
  message: string;
  data?: {
    user_id?: string;
  };
}

interface CreateUserPayload {
  username: string;
  password: string;
  email: string;
  phone: string;
  gender: string;
  avatar?: string;
  role_id: string | number;
}

@Component({
  selector: 'app-user-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './user-create.component.html',
  styleUrl: './user-create.component.scss'
})
export class UserCreateComponent {
  readonly fallbackAvatar =
    'https://gw.alipayobjects.com/zos/rmsportal/BiazfanxmamNRoxxVxka.png';

  readonly genderOptions = ['Male', 'Female', 'Other', 'Prefer not to say'];
  readonly defaultRoleId = '0';

  readonly avatarSuggestions = [
    'https://i.pravatar.cc/300?img=15',
    'https://i.pravatar.cc/300?img=32',
    'https://i.pravatar.cc/300?img=45'
  ];

  readonly requiredFieldPaths = ['username', 'password', 'email', 'phone', 'gender'];

  readonly maxAvatarSizeMb = 3;
  readonly maxAvatarSizeBytes = this.maxAvatarSizeMb * 1024 * 1024;

  avatarInputMode: 'url' | 'upload' = 'url';
  createForm: FormGroup;
  isSubmitting = false;
  serverError = '';
  serverMessage = '';
  lastCreatedAt: Date | null = null;
  avatarFileName = '';
  avatarUploadError = '';
  isAvatarDropActive = false;
  private avatarDragDepth = 0;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private popupService: PopupService
  ) {
    this.createForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.minLength(8)]],
      gender: ['', Validators.required],
      avatar: ['']
    });
  }

  get avatarPreview(): string {
    const raw = this.createForm.get('avatar')?.value?.trim();
    return raw || this.fallbackAvatar;
  }

  get selectedRoleLabel(): string {
    return 'Client user';
  }

  get completionPercent(): number {
    const total = this.requiredFieldPaths.length;
    const completed = this.requiredFieldPaths.filter(path => {
      const control = this.getControl(path);
      if (!control) {
        return false;
      }
      const value = control.value;
      const hasValue = value !== null && value !== undefined && value !== '';
      return control.valid && hasValue;
    }).length;
    return Math.round((completed / total) * 100);
  }

  get passwordStrengthLabel(): string {
    switch (this.passwordScore) {
      case 3:
        return 'Strong';
      case 2:
        return 'Good';
      case 1:
        return 'Weak';
      default:
        return 'Too short';
    }
  }

  get passwordStrengthClass(): string {
    return ['very-weak', 'weak', 'medium', 'strong'][this.passwordScore] ?? 'very-weak';
  }

  controlInvalid(path: string): boolean {
    const control = this.getControl(path);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  controlErrorMessage(path: string): string {
    const control = this.getControl(path);
    if (!control || !control.errors) {
      return '';
    }
    if (control.errors['required']) {
      return 'This field is required';
    }
    if (control.errors['minlength']) {
      const requiredLength = control.errors['minlength'].requiredLength;
      return `Minimum ${requiredLength} characters`;
    }
    if (control.errors['email']) {
      return 'Enter a valid email';
    }
    return 'Invalid value';
  }

  applySuggestedUsername(): void {
    const email = this.createForm.get('email')?.value?.toString();
    const baseFromEmail = email?.split('@')[0];
    const suggestion =
      baseFromEmail && baseFromEmail.length >= 3
        ? `${baseFromEmail}.${new Date().getFullYear()}`
        : `client.${Math.floor(Math.random() * 9000 + 1000)}`;
    this.createForm.patchValue({ username: suggestion });
    this.createForm.get('username')?.markAsDirty();
    this.createForm.get('username')?.markAsTouched();
  }

  useAvatarSuggestion(url: string): void {
    this.createForm.patchValue({ avatar: url });
    this.createForm.get('avatar')?.markAsDirty();
    this.avatarInputMode = 'url';
    this.avatarFileName = '';
    this.avatarUploadError = '';
  }

  prefillDemoUser(): void {
    this.createForm.patchValue({
      username: `client.${Date.now().toString().slice(-4)}`,
      password: 'Client@123',
      email: `client${Date.now().toString().slice(-4)}@example.com`,
      phone: '+1 555 012 3456',
      gender: 'Other',
      avatar: this.avatarSuggestions[0]
    });
    this.avatarInputMode = 'url';
    this.avatarFileName = '';
    this.avatarUploadError = '';
    this.createForm.markAllAsTouched();
  }

  resetForm(): void {
    this.createForm.reset({
      username: '',
      password: '',
      email: '',
      phone: '',
      gender: '',
      avatar: ''
    });
    this.serverError = '';
    this.serverMessage = '';
    this.avatarInputMode = 'url';
    this.avatarFileName = '';
    this.avatarUploadError = '';
    this.isAvatarDropActive = false;
    this.avatarDragDepth = 0;
  }

  handlePhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = input.value.replace(/[^\d+]/g, '').replace(/(.{3})/g, '$1 ').trim();
    this.createForm.patchValue({ phone: formatted });
  }

  async submit(): Promise<void> {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    const payload = this.buildPayload();
    const token = localStorage.getItem('TOKEN') ?? '';

    this.isSubmitting = true;
    this.serverError = '';

    try {
      const response = await axios.post<CreateUserResponse>(
        `${environment.server_url}/admin/users`,
        payload,
        { headers: { Authorization: token } }
      );

      if (!response.data?.status) {
        const message = response.data?.message || 'Failed to create user';
        this.serverError = message;
        this.popupService.AlertErrorDialog(message, 'Create user failed');
        return;
      }

      const successMessage = response.data?.message || 'Client user created successfully';
      this.serverMessage = successMessage;
      this.lastCreatedAt = new Date();
      this.popupService.AlertSuccessDialog(successMessage, 'Success');
      this.resetForm();
    } catch (error: any) {
      console.error('Error creating user:', error);
      if (error.response?.status === 401) {
        this.popupService.AlertErrorDialog(
          'Session expired. Please log in again.',
          'Unauthorized'
        );
        localStorage.removeItem('TOKEN');
        this.router.navigate(['/admin/login']);
        return;
      }
      const message =
        error.response?.data?.message ||
        (error.response?.status === 409
          ? 'A user with similar credentials already exists'
          : 'Failed to create user');
      this.serverError = message;
      this.popupService.AlertErrorDialog(message, 'Create user failed');
    } finally {
      this.isSubmitting = false;
    }
  }

  goBack(): void {
    this.router.navigate(['/admin/users']);
  }

  handleAvatarError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (!img) {
      return;
    }
    img.src = this.fallbackAvatar;
  }

  setAvatarInputMode(mode: 'url' | 'upload'): void {
    if (this.avatarInputMode === mode) {
      return;
    }
    this.avatarInputMode = mode;
    this.avatarUploadError = '';
    if (mode === 'url') {
      this.isAvatarDropActive = false;
      this.avatarDragDepth = 0;
      this.avatarFileName = '';
    }
  }

  onAvatarUrlInput(): void {
    if (this.avatarInputMode !== 'url') {
      return;
    }
    this.avatarFileName = '';
    this.avatarUploadError = '';
  }

  openAvatarPicker(element: HTMLInputElement): void {
    if (this.isSubmitting || this.avatarInputMode !== 'upload') {
      return;
    }
    element.click();
  }

  onAvatarFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.processAvatarFile(file, () => {
      input.value = '';
    });
  }

  onAvatarDragEnter(event: DragEvent): void {
    if (this.avatarInputMode !== 'upload') {
      return;
    }
    event.preventDefault();
    this.isAvatarDropActive = true;
    this.avatarDragDepth += 1;
  }

  onAvatarDragOver(event: DragEvent): void {
    if (this.avatarInputMode !== 'upload') {
      return;
    }
    event.preventDefault();
  }

  onAvatarDragLeave(event: DragEvent): void {
    if (this.avatarInputMode !== 'upload') {
      return;
    }
    event.preventDefault();
    this.avatarDragDepth = Math.max(0, this.avatarDragDepth - 1);
    if (this.avatarDragDepth === 0) {
      this.isAvatarDropActive = false;
    }
  }

  onAvatarDrop(event: DragEvent): void {
    if (this.avatarInputMode !== 'upload') {
      return;
    }
    event.preventDefault();
    this.isAvatarDropActive = false;
    this.avatarDragDepth = 0;
    const file = event.dataTransfer?.files?.[0];
    this.processAvatarFile(file);
  }

  clearAvatarSelection(): void {
    this.createForm.patchValue({ avatar: '' });
    this.createForm.get('avatar')?.markAsPristine();
    this.avatarFileName = '';
    this.avatarUploadError = '';
    this.isAvatarDropActive = false;
    this.avatarDragDepth = 0;
  }

  private getControl(path: string): AbstractControl | null {
    return this.createForm.get(path);
  }

  private get passwordScore(): number {
    const password = this.createForm.get('password')?.value ?? '';
    if (!password) {
      return 0;
    }
    let score = 0;
    if (password.length >= 6) {
      score += 1;
    }
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) {
      score += 1;
    }
    if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) {
      score += 1;
    }
    if (password.length >= 10 && /\W/.test(password)) {
      score = 3;
    }
    return Math.min(score, 3);
  }

  private buildPayload(): CreateUserPayload {
    const formValue = this.createForm.value;

    return {
      username: (formValue['username'] ?? '').toString().trim(),
      password: (formValue['password'] ?? '').toString(),
      email: (formValue['email'] ?? '').toString().trim().toLowerCase(),
      phone: (formValue['phone'] ?? '').toString().replace(/\s+/g, ''),
      gender: (formValue['gender'] ?? '').toString().trim(),
      avatar: formValue['avatar']?.toString().trim() || undefined,
      role_id: this.defaultRoleId
    };
  }

  private processAvatarFile(file?: File | null, onComplete?: () => void): void {
    if (!file) {
      onComplete?.();
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.avatarUploadError = 'Only image files are supported.';
      onComplete?.();
      return;
    }

    if (file.size > this.maxAvatarSizeBytes) {
      this.avatarUploadError = `Please choose an image under ${this.maxAvatarSizeMb} MB.`;
      onComplete?.();
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        this.avatarUploadError = 'Unable to read the selected file.';
        onComplete?.();
        return;
      }
      this.createForm.patchValue({ avatar: result });
      this.createForm.get('avatar')?.markAsDirty();
      this.avatarFileName = file.name;
      this.avatarUploadError = '';
      onComplete?.();
    };
    reader.onerror = () => {
      this.avatarUploadError = 'Something went wrong while reading the file.';
      onComplete?.();
    };
    reader.readAsDataURL(file);
  }
}


