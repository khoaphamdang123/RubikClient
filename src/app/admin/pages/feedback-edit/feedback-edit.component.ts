import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import axios from 'axios';
import { environment } from '../../../../environments/environment';
import { PopupService } from '../../../../services/popup.service';

interface FeedbackUserSummary {
  _id?: number;
  username?: string;
  display_name?: string;
  email?: string;
}

interface FeedbackCategorySummary {
  _id?: number;
  category_name?: string;
}

interface FeedbackDetail {
  _id: number;
  subject?: string;
  feedback_content?: string;
  feedback_response?: string;
  status?: string;
  user_id?: number;
  category_id?: number;
  created_date?: string;
  updated_date?: string;
}

interface FeedbackDetailResponse {
  status: boolean;
  message: string;
  data?: {
    feedback?: FeedbackDetail | null;
    user?: FeedbackUserSummary | null;
    category?: FeedbackCategorySummary | null;
  };
}

interface UpdateFeedbackResponse {
  status: boolean;
  message: string;
  data?: {
    feedback?: FeedbackDetail;
  };
}

@Component({
  selector: 'app-feedback-edit',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './feedback-edit.component.html',
  styleUrl: './feedback-edit.component.scss'
})
export class FeedbackEditComponent implements OnInit {
  feedbackForm: FormGroup;
  isLoading = true;
  isSaving = false;
  loadError: string | null = null;
  feedbackId = '';
  feedbackData: FeedbackDetail | null = null;
  feedbackOwner: FeedbackUserSummary | null = null;
  feedbackCategory: FeedbackCategorySummary | null = null;
  serverMessage = '';
  lastSyncedAt: Date | null = null;
  responseSubmitSuccess = '';
  responseSubmitError = '';

  readonly maxResponseLength = 2000;

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly popupService: PopupService
  ) {
    this.feedbackForm = this.fb.group({
      subject: [{ value: '', disabled: true }],
      username: [{ value: '', disabled: true }],
      email: [{ value: '', disabled: true }],
      category: [{ value: '', disabled: true }],
      status: [{ value: '', disabled: true }],
      feedback_content: [{ value: '', disabled: true }],
      feedback_response: [
        '',
        [Validators.required, Validators.minLength(5), Validators.maxLength(this.maxResponseLength)]
      ]
    });
  }

  ngOnInit(): void {
    this.feedbackId = this.route.snapshot.paramMap.get('id') || '';

    if (!this.feedbackId) {
      this.loadError = 'Missing feedback identifier. Please return to the inbox.';
      this.isLoading = false;
      return;
    }

    this.fetchFeedback();
  }

  get responseControl() {
    return this.feedbackForm.get('feedback_response');
  }

  get disableSave(): boolean {
    return !!(
      this.isSaving ||
      !this.responseControl ||
      this.responseControl.invalid ||
      !this.responseControl.dirty
    );
  }

  get disableReset(): boolean {
    return !!(this.isSaving || !this.responseControl || !this.responseControl.dirty);
  }

  get displayUsername(): string {
    if (this.feedbackOwner?.display_name) {
      return this.feedbackOwner.display_name;
    }
    if (this.feedbackOwner?.username) {
      return this.feedbackOwner.username;
    }
    return 'Unknown user';
  }

  get displayEmail(): string {
    return this.feedbackOwner?.email || 'No email provided';
  }

  get avatarInitial(): string {
    const name = this.displayUsername.trim();
    return name ? name.charAt(0).toUpperCase() : 'U';
  }

  get categoryLabel(): string {
    return (
      this.feedbackCategory?.category_name ||
      (this.feedbackData?.category_id !== undefined && this.feedbackData?.category_id !== null
        ? `#${this.feedbackData.category_id}`
        : 'Uncategorized')
    );
  }

  get statusLabel(): string {
    return this.feedbackData?.status?.trim() || 'Pending';
  }

  get statusChipClass(): string {
    const normalized = this.statusLabel.toLowerCase();
    if (['resolved', 'completed', 'done', 'responded', 'replied', 'closed'].includes(normalized)) {
      return 'status-chip success';
    }
    if (['in progress', 'processing', 'reviewing'].includes(normalized)) {
      return 'status-chip info';
    }
    if (['rejected', 'declined', 'dismissed'].includes(normalized)) {
      return 'status-chip danger';
    }
    return 'status-chip pending';
  }

  get responseCharactersLeft(): number {
    const length = (this.responseControl?.value?.length ?? 0);
    return Math.max(this.maxResponseLength - length, 0);
  }

  async fetchFeedback(): Promise<void> {
    try {
      this.isLoading = true;
      this.loadError = null;
      this.responseSubmitError = '';
      this.responseSubmitSuccess = '';

      const token = localStorage.getItem('TOKEN') ?? '';
      if (!token) {
        throw new Error('Missing admin session. Please sign in again.');
      }

      const response = await axios.get<FeedbackDetailResponse>(
        `${environment.server_url}/admin/feedback/${this.feedbackId}`,
        { headers: { Authorization: token } }
      );

      if (!response.data.status || !response.data.data?.feedback) {
        throw new Error(response.data.message || 'Unable to load feedback details.');
      }

      this.feedbackData = response.data.data.feedback || null;
      this.feedbackOwner = response.data.data.user || null;
      this.feedbackCategory = response.data.data.category || null;
      this.serverMessage = response.data.message || 'Feedback detail retrieved successfully.';
      this.lastSyncedAt = new Date();

      this.feedbackForm.patchValue(
        {
          subject: this.feedbackData?.subject || 'Untitled feedback',
          username: this.displayUsername,
          email: this.displayEmail,
          category: this.categoryLabel,
          status: this.statusLabel,
          feedback_content: this.feedbackData?.feedback_content || 'No message provided.',
          feedback_response: this.feedbackData?.feedback_response || ''
        },
        { emitEvent: false }
      );

      this.feedbackForm.markAsPristine();
    } catch (error: any) {
      console.error('Failed to load feedback:', error);
      if (error?.response?.status === 401) {
        this.popupService.AlertErrorDialog('Session expired. Please log in again.', 'Unauthorized');
        localStorage.removeItem('TOKEN');
        this.router.navigate(['/admin/login']);
        return;
      }

      if (error?.response?.status === 404) {
        this.loadError = 'Feedback not found or already removed.';
        return;
      }

      this.loadError = error?.response?.data?.message || error?.message || 'Failed to load feedback.';
    } finally {
      this.isLoading = false;
    }
  }

  async saveResponse(): Promise<void> {
    if (!this.responseControl) {
      return;
    }

    if (this.responseControl.invalid) {
      this.responseControl.markAsTouched();
      return;
    }

    const token = localStorage.getItem('TOKEN') ?? '';
    if (!token) {
      this.popupService.AlertErrorDialog('Missing admin session. Please sign in again.', 'Unauthorized');
      this.router.navigate(['/admin/login']);
      return;
    }

    const responseCopy = (this.responseControl.value || '').trim();

    this.isSaving = true;
    this.responseSubmitError = '';
    this.responseSubmitSuccess = '';

    try {
      const payload = {
        feedback_response: responseCopy,
        status: this.feedbackData?.status || 'Pending'
      };

      const response = await axios.post<UpdateFeedbackResponse>(
        `${environment.server_url}/admin/feedback/${this.feedbackId}`,
        payload,
        { headers: { Authorization: token } }
      );

      if (!response.data.status) {
        throw new Error(response.data.message || 'Failed to update feedback.');
      }

      this.feedbackData = response.data.data?.feedback ?? this.feedbackData;
      this.responseSubmitSuccess = response.data.message || 'Feedback response saved.';
      this.popupService.AlertSuccessDialog(this.responseSubmitSuccess, 'Feedback updated');
      this.feedbackForm.markAsPristine();
      this.responseControl.setValue(responseCopy, { emitEvent: false });
      this.responseControl.markAsPristine();
      this.lastSyncedAt = new Date();
      await this.fetchFeedback();
    } catch (error: any) {
      console.error('Failed to save feedback response:', error);
      if (error?.response?.status === 401) {
        this.popupService.AlertErrorDialog('Session expired. Please log in again.', 'Unauthorized');
        localStorage.removeItem('TOKEN');
        this.router.navigate(['/admin/login']);
        return;
      }

      this.responseSubmitError = error?.response?.data?.message || error?.message || 'Failed to update feedback.';
      this.popupService.AlertErrorDialog(this.responseSubmitError, 'Update failed');
    } finally {
      this.isSaving = false;
    }
  }

  resetResponse(): void {
    this.responseControl?.setValue(this.feedbackData?.feedback_response || '');
    this.feedbackForm.markAsPristine();
    this.responseControl?.markAsPristine();
    this.responseSubmitError = '';
    this.responseSubmitSuccess = '';
  }

  refresh(): void {
    if (!this.isLoading) {
      this.fetchFeedback();
    }
  }

  goBack(): void {
    this.router.navigate(['/admin/feedback']);
  }

  formatDate(value?: string): string {
    if (!value) {
      return '—';
    }
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  }
}