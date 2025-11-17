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

interface CreateProductResponse {
  status: boolean;
  message: string;
  data?: {
    product?: ProductRecord;
  };
}

interface ProductRecord {
  _id?: string;
  id?: number;
  name: string;
  description: string;
  avatar: string;
  feature: string;
  category_id?: number;
}

interface CreateProductPayload {
  name: string;
  description: string;
  avatar: string;
  feature: string;
  category_id?: number;
}

@Component({
  selector: 'app-product-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './product-create.component.html',
  styleUrl: './product-create.component.scss'
})
export class ProductCreateComponent {
  readonly fallbackAvatar =
    'https://gw.alipayobjects.com/zos/rmsportal/BiazfanxmamNRoxxVxka.png';
  readonly avatarSuggestions = [
    'https://i.imgur.com/9bK0H1S.png',
    'https://i.imgur.com/C0j6r8G.png',
    'https://i.imgur.com/5ZQk9qP.png'
  ];
  readonly requiredFieldPaths = ['name', 'description', 'feature', 'avatar'];
  readonly maxAvatarSizeMb = 3;
  readonly maxAvatarSizeBytes = this.maxAvatarSizeMb * 1024 * 1024;

  createForm: FormGroup;
  avatarInputMode: 'url' | 'upload' = 'url';
  isSubmitting = false;
  serverError = '';
  serverMessage = '';
  lastCreatedAt: Date | null = null;
  createdProductName = '';

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
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required, Validators.minLength(10)]],
      feature: ['', [Validators.required, Validators.minLength(3)]],
      avatar: ['', Validators.required],
      category_id: ['', [Validators.pattern(/^\d*$/)]]
    });
  }

  get completionPercent(): number {
    const total = this.requiredFieldPaths.length;
    const completed = this.requiredFieldPaths.filter(path => {
      const control = this.getControl(path);
      const value = control?.value;
      const hasValue = value !== null && value !== undefined && value !== '';
      return !!control && control.valid && hasValue;
    }).length;
    return Math.round((completed / total) * 100);
  }

  get avatarPreview(): string {
    const raw = this.createForm.get('avatar')?.value?.toString().trim();
    return raw || this.fallbackAvatar;
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
      const length = control.errors['minlength'].requiredLength;
      return `Minimum ${length} characters`;
    }
    if (control.errors['pattern']) {
      return 'Only digits are allowed';
    }
    if (control.errors['integer']) {
      return 'Category ID must be a whole number';
    }
    return 'Invalid value';
  }

  async submit(): Promise<void> {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    const payload = this.buildPayload();
    if (!payload) {
      return;
    }

    const token = localStorage.getItem('TOKEN') ?? '';
    this.isSubmitting = true;
    this.serverError = '';

    try {
      const response = await axios.post<CreateProductResponse>(
        `${environment.server_url}/admin/products`,
        payload,
        { headers: { Authorization: token } }
      );

      if (!response.data?.status) {
        const message = response.data?.message || 'Failed to create product';
        this.serverError = message;
        this.popupService.AlertErrorDialog(message, 'Create product failed');
        return;
      }

      const successMessage = response.data?.message || 'Product created successfully';
      this.serverMessage = successMessage;
      this.lastCreatedAt = new Date();
      this.createdProductName = response.data?.data?.product?.name || payload.name;
      this.popupService.AlertSuccessDialog(successMessage, 'Success');
      this.resetForm();
    } catch (error: any) {
      console.error('Error creating product:', error);
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
          ? 'Product name already exists'
          : 'Failed to create product');
      this.serverError = message;
      this.popupService.AlertErrorDialog(message, 'Create product failed');
    } finally {
      this.isSubmitting = false;
    }
  }

  prefillDemoProduct(): void {
    const timestamp = Date.now().toString().slice(-4);
    this.createForm.patchValue({
      name: `Cube ${timestamp}`,
      description:
        'Limited edition speed cube engineered for stability and ultra-fast solves.',
      feature: 'Magnetic core · Frosted surface · Adjustable elasticity',
      avatar: this.avatarSuggestions[0],
      category_id: '101'
    });
    this.avatarInputMode = 'url';
    this.avatarFileName = '';
    this.avatarUploadError = '';
    this.createForm.markAllAsTouched();
  }

  resetForm(): void {
    this.createForm.reset({
      name: '',
      description: '',
      feature: '',
      avatar: '',
      category_id: ''
    });
    this.serverError = '';
    this.serverMessage = '';
    this.createdProductName = '';
    this.lastCreatedAt = null;
    this.avatarInputMode = 'url';
    this.avatarFileName = '';
    this.avatarUploadError = '';
    this.isAvatarDropActive = false;
    this.avatarDragDepth = 0;
  }

  goBack(): void {
    this.router.navigate(['/admin/products']);
  }

  useAvatarSuggestion(url: string): void {
    this.createForm.patchValue({ avatar: url });
    this.createForm.get('avatar')?.markAsDirty();
    this.avatarInputMode = 'url';
    this.avatarFileName = '';
    this.avatarUploadError = '';
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

  handleAvatarError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (!img) {
      return;
    }
    img.src = this.fallbackAvatar;
  }

  private buildPayload(): CreateProductPayload | null {
    const value = this.createForm.value;
    const payload: CreateProductPayload = {
      name: (value['name'] ?? '').toString().trim(),
      description: (value['description'] ?? '').toString().trim(),
      feature: (value['feature'] ?? '').toString().trim(),
      avatar: (value['avatar'] ?? '').toString().trim()
    };

    const categoryRaw = value['category_id']?.toString().trim();
    if (categoryRaw) {
      const parsed = Number(categoryRaw);
      if (!Number.isInteger(parsed)) {
        this.createForm.get('category_id')?.setErrors({ integer: true });
        this.createForm.markAsTouched();
        return null;
      }
      payload.category_id = parsed;
    }

    return payload;
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

  private getControl(path: string): AbstractControl | null {
    return this.createForm.get(path);
  }
}


