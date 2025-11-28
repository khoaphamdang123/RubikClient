import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import axios from 'axios';
import { environment } from '../../../environments/environment';
import { PopupService } from '../../../services/popup.service';

interface FocusStates {
  subject: boolean;
  message: boolean;
}

interface SubmitFeedbackResponse {
  status: boolean;
  message: string;
}

interface FeedbackSubmissionPayload {
  subject: string;
  feedback_content: string;
  status: string;
  category_id: number;
  feedback_response?: string;
}

interface FeedbackCategory {
  _id: number;
  category_name: string;
}

interface FeedbackCategoryResponse {
  status: boolean;
  message: string;
  data?: {
    categories: FeedbackCategory[];
  };
}

interface CategoryOption {
  value: number;
  label: string;
}

@Component({
  selector: 'app-feedback-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './feedback.component.html',
  styleUrl: './feedback.component.scss',
  providers: [PopupService]
})
export class FeedbackPageComponent implements OnInit {
  readonly maxCharacters = 800;

  feedbackForm: FormGroup;
  isSubmitting = false;
  submitSuccessMessage = '';
  submitErrorMessage = '';
  lastSubmittedAt: Date | null = null;
  isCategoryLoading = false;
  categoryLoadError = '';

  focusStates: FocusStates = {
    subject: false,
    message: false
  };

  categoryOptions: CategoryOption[] = [];

  ratingLabels = ['Needs work', 'Okay', 'Good', 'Great', 'Wonderful'];

  constructor(private fb: FormBuilder, private popupService: PopupService) {
    this.feedbackForm = this.fb.group({
      subject: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(120)]],
      category: [null, Validators.required],
      message: ['', [Validators.required, Validators.minLength(20), Validators.maxLength(this.maxCharacters)]],
      rating: [4, [Validators.min(1), Validators.max(5)]],
      allowFollowUp: [true]
    });
  }

  ngOnInit(): void {
    this.loadCategoryOptions();
  }

  get messageLength(): number {
    return (this.feedbackForm.get('message')?.value ?? '').length;
  }

  private async loadCategoryOptions(): Promise<void> {
    this.isCategoryLoading = true;
    this.categoryLoadError = '';

    try {
      const token = localStorage.getItem('TOKEN');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = token;
      }

      const response = await axios.get<FeedbackCategoryResponse>(
        `${environment.server_url}/admin/feedback-categories`,
        {
          params: { page: 1, limit: 50 },
          headers
        }
      );

      const categories = response.data.data?.categories ?? [];
      if (response.data.status && categories.length) {
        this.categoryOptions = categories
          .filter(category => Number.isInteger(category._id))
          .map(category => ({
            value: Number(category._id),
            label: category.category_name
          }));

        if (!this.categoryOptions.length) {
          this.categoryLoadError = 'No feedback categories were found.';
        }
      } else {
        this.categoryOptions = [];
        this.categoryLoadError = 'No feedback categories were found.';
      }
    } catch (error: any) {
      this.categoryOptions = [];
      this.categoryLoadError =
        error?.response?.data?.message || 'Unable to load categories right now. Please try again later.';
    } finally {
      this.isCategoryLoading = false;
      this.ensureCategorySelection();
    }
  }

  private ensureCategorySelection(): void {
    if (this.categoryOptions.length) {
      const currentValue = this.feedbackForm.get('category')?.value;
      const hasMatch = this.categoryOptions.some(option => option.value === currentValue);

      if (!hasMatch) {
        this.feedbackForm.patchValue({ category: this.categoryOptions[0].value });
      }
    } else {
      this.feedbackForm.patchValue({ category: null });
    }
  }

  get remainingCharacters(): number {
    return this.maxCharacters - this.messageLength;
  }

  get isUserLoggedIn(): boolean {
    return Boolean(localStorage.getItem('TOKEN'));
  }

  setFocus(field: keyof FocusStates, state: boolean): void {
    this.focusStates[field] = state;
  }

  async submitFeedback(): Promise<void> {
    if (this.feedbackForm.invalid || this.isSubmitting) {
      this.feedbackForm.markAllAsTouched();
      return;
    }

    if (!this.categoryOptions.length) {
      this.submitErrorMessage = 'Feedback categories are unavailable right now. Please try again later.';
      this.popupService.AlertErrorDialog(this.submitErrorMessage, 'Feedback');
      return;
    }

    this.isSubmitting = true;
    this.submitErrorMessage = '';
    this.submitSuccessMessage = '';

    const formValue = this.feedbackForm.value;

    const selectedCategory = this.categoryOptions.find(option => option.value === formValue.category);
    const parsedCategoryId =
      typeof formValue.category === 'number'
        ? formValue.category
        : selectedCategory?.value ?? Number(formValue.category);

    if (!Number.isInteger(parsedCategoryId)) {
      this.isSubmitting = false;
      this.submitErrorMessage = 'Please select a valid feedback category.';
      return;
    }

    const categoryLabel = selectedCategory?.label ?? 'Uncategorized';
    const ratingValue = formValue.rating ?? 0;
    const ratingCopy = `${ratingValue}/5${this.ratingLabels[ratingValue - 1] ? ` (${this.ratingLabels[ratingValue - 1]})` : ''}`;
    const followUpCopy = formValue.allowFollowUp ? 'Yes' : 'No';
    const metadataLine = `Category: ${categoryLabel} • Experience rating: ${ratingCopy} • Allow follow-up: ${followUpCopy}`;
    const compiledContent = `${metadataLine}\n\n${formValue.message.trim()}`;

    const payload: FeedbackSubmissionPayload = {
      subject: formValue.subject.trim(),
      feedback_content: compiledContent,
      status: 'Pending',
      category_id: parsedCategoryId
    };

    const token = localStorage.getItem('TOKEN');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = token;
    }

    try {
      const response = await axios.post<SubmitFeedbackResponse>(
        `${environment.server_url}/feedback`,
        payload,
        { headers }
      );

      if (response.data.status) {
        const successMessage = response.data.message || 'Thanks for sharing your feedback with us!';
        this.submitSuccessMessage = successMessage;
        this.popupService.AlertSuccessDialog(successMessage, 'Feedback sent');
        this.lastSubmittedAt = new Date();
        this.feedbackForm.reset({
          subject: '',
          category: this.categoryOptions[0]?.value ?? null,
          message: '',
          rating: 4,
          allowFollowUp: true
        });
      } else {
        const message = response.data.message || 'Unable to send feedback right now.';
        this.submitErrorMessage = message;
        this.popupService.AlertErrorDialog(message, 'Feedback');
      }
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        (error?.response?.status === 401
          ? 'Please sign in to send feedback.'
          : 'We ran into a problem sending your feedback. Please try again.');
      this.submitErrorMessage = message;
      this.popupService.AlertErrorDialog(message, 'Feedback');
    } finally {
      this.isSubmitting = false;
    }
  }
}

