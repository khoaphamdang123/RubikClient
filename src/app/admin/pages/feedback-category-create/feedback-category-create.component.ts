import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import axios from 'axios';
import { environment } from '../../../../environments/environment';
import { PopupService } from '../../../../services/popup.service';

interface CreateFeedbackCategoryResponse {
  status: boolean;
  message: string;
}

@Component({
  selector: 'app-feedback-category-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './feedback-category-create.component.html',
  styleUrls: ['./feedback-category-create.component.scss']
})
export class FeedbackCategoryCreateComponent {
  categoryForm: FormGroup;
  isSubmitting = false;
  submitError: string | null = null;
  submitSuccess: string | null = null;

  constructor(
    private readonly fb: FormBuilder,
    private readonly router: Router,
    private readonly popupService: PopupService
  ) {
    this.categoryForm = this.fb.group({
      category_name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(60)]]
    });
  }

  controlInvalid(controlName: string): boolean {
    const control = this.categoryForm.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  controlErrorMessage(controlName: string): string {
    const control = this.categoryForm.get(controlName);
    if (!control || !control.errors) {
      return '';
    }
    if (control.errors['required']) {
      return 'This field is required.';
    }
    if (control.errors['minlength']) {
      const min = control.errors['minlength']?.requiredLength;
      return `Minimum ${min} characters.`;
    }
    if (control.errors['maxlength']) {
      const max = control.errors['maxlength']?.requiredLength;
      return `Maximum ${max} characters.`;
    }
    return 'Invalid value.';
  }

  async submitCategory(): Promise<void> {
    this.submitError = null;
    this.submitSuccess = null;

    if (this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      return;
    }

    const token = localStorage.getItem('TOKEN');
    if (!token) {
      this.popupService.AlertErrorDialog('Missing admin token. Please sign in again.', 'Authorization required');
      this.router.navigate(['/admin/login']);
      return;
    }

    const payload = {
      category_name: this.categoryForm.value.category_name.trim()
    };

    this.isSubmitting = true;

    try {
      const response = await axios.post<CreateFeedbackCategoryResponse>(
        `${environment.server_url}/admin/feedback-categories`,
        payload,
        { headers: { Authorization: token } }
      );

      if (response.data.status) {
        const message = response.data.message || 'Feedback category created successfully';
        this.submitSuccess = message;
        this.popupService.AlertSuccessDialog(message, 'Success');
        this.categoryForm.reset();
      } else {
        const message = response.data.message || 'Failed to create feedback category';
        this.submitError = message;
        this.popupService.AlertErrorDialog(message, 'Error');
      }
    } catch (error: any) {
      console.error('Failed to create feedback category', error);
      if (error?.response?.status === 401) {
        this.popupService.AlertErrorDialog('Session expired. Please login again.', 'Unauthorized');
        localStorage.removeItem('TOKEN');
        this.router.navigate(['/admin/login']);
        return;
      }
      const message =
        error?.response?.data?.message ||
        (error?.response?.status === 409
          ? 'A category with this name already exists.'
          : 'Unable to create feedback category.');
      this.submitError = message;
      this.popupService.AlertErrorDialog(message, 'Error');
    } finally {
      this.isSubmitting = false;
    }
  }

  navigateBack(): void {
    this.router.navigate(['/admin/feedback-categories']);
  }
}


