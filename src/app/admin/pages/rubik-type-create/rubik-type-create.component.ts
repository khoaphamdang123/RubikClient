import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import axios from 'axios';
import { environment } from '../../../../environments/environment';
import { PopupService } from '../../../../services/popup.service';

interface CreateRubikTypeResponse {
  status: boolean;
  message: string;
  data?: {
    rubikType?: {
      _id: string;
      type_name: string;
      variation: number;
      created_date?: string;
      updated_date?: string;
    };
  };
}

@Component({
  selector: 'app-rubik-type-create',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rubik-type-create.component.html',
  styleUrl: './rubik-type-create.component.scss'
})
export class RubikTypeCreateComponent {
  form = {
    type_name: '',
    variation: ''
  };

  isSaving = false;
  error: string | null = null;

  constructor(
    private readonly router: Router,
    private readonly popupService: PopupService
  ) {}

  get canSubmit(): boolean {
    return Boolean(this.form.type_name.trim()) && this.isVariationValid;
  }

  get isVariationValid(): boolean {
    const parsed = this.getParsedVariation();
    return !Number.isNaN(parsed) && parsed >= 0;
  }

  navigateBack(): void {
    this.router.navigate(['/admin/rubik-types']);
  }

  async createRubikType(): Promise<void> {
    this.error = null;

    const trimmedName = this.form.type_name.trim();
    const parsedVariation = this.getParsedVariation();

    if (!trimmedName) {
      this.error = 'Type name is required.';
      this.popupService.AlertErrorDialog(this.error, 'Validation error');
      return;
    }

    if (Number.isNaN(parsedVariation)) {
      this.error = 'Variation must be a valid number.';
      this.popupService.AlertErrorDialog(this.error, 'Validation error');
      return;
    }

    const token = localStorage.getItem('TOKEN');
    if (!token) {
      this.popupService.AlertErrorDialog('Missing admin token. Please sign in again.', 'Authorization required');
      this.router.navigate(['/admin/login']);
      return;
    }

    this.isSaving = true;

    try {
      const response = await axios.post<CreateRubikTypeResponse>(
        `${environment.server_url}/admin/rubik-types`,
        {
          type_name: trimmedName,
          variation: parsedVariation
        },
        {
          headers: {
            Authorization: token
          }
        }
      );

      if (response.data.status) {
        const message = response.data.message || 'Rubik type created successfully';
        this.popupService.AlertSuccessDialog(message, 'Success');
        this.resetForm();
        this.router.navigate(['/admin/rubik-types']);
      } else {
        const msg = response.data.message || 'Failed to create rubik type';
        this.handleError(msg);
      }
    } catch (error: any) {
      if (error?.response?.status === 401) {
        this.handleUnauthorized();
        return;
      }

      if (error?.response?.status === 409) {
        const msg = error?.response?.data?.message || 'Rubik type name already exists';
        this.handleError(msg);
        return;
      }

      if (error?.response?.status === 400) {
        const msg = error?.response?.data?.message || 'type_name and numeric variation are required';
        this.handleError(msg);
        return;
      }

      const fallbackMsg = error?.response?.data?.message || error?.message || 'Failed to create rubik type';
      this.handleError(fallbackMsg);
    } finally {
      this.isSaving = false;
    }
  }

  private getParsedVariation(): number {
    if (this.form.variation === null || this.form.variation === undefined) {
      return Number.NaN;
    }
    const raw = String(this.form.variation).trim();
    if (!raw) {
      return Number.NaN;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }

  private resetForm(): void {
    this.form = {
      type_name: '',
      variation: ''
    };
  }

  private handleError(message: string): void {
    this.error = message;
    this.popupService.AlertErrorDialog(message, 'Rubik type');
  }

  private handleUnauthorized(): void {
    this.popupService.AlertErrorDialog('Session expired. Please login again.', 'Unauthorized');
    localStorage.removeItem('TOKEN');
    this.router.navigate(['/admin/login']);
  }
}


