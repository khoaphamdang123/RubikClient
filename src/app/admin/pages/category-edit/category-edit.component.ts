import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import axios from 'axios';
import { environment } from '../../../../environments/environment';
import { PopupService } from '../../../../services/popup.service';

interface Category {
  _id?: number;
  category_name?: string;
  description?: string;
  created_date?: string;
  updated_date?: string;
}

interface CategoryDetailResponse {
  status: boolean;
  message: string;
  data?: {
    category?: Category;
  };
}

interface UpdateCategoryResponse {
  status: boolean;
  message: string;
  data?: {
    category?: Category;
  };
}

@Component({
  selector: 'app-category-edit',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './category-edit.component.html',
  styleUrl: './category-edit.component.scss'
})
export class CategoryEditComponent implements OnInit {
  categoryForm: FormGroup;
  isLoading = true;
  isSaving = false;
  loadError: string | null = null;
  categoryId = '';
  categoryData?: Category;
  initialFormValue: any;
  serverMessage = '';
  lastSyncedAt: Date | null = null;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private popupService: PopupService
  ) {
    this.categoryForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(120)]],
      description: ['', [Validators.maxLength(500)]]
    });
  }

  ngOnInit(): void {
    this.categoryId = this.route.snapshot.paramMap.get('id') || '';

    if (!this.categoryId) {
      this.loadError = 'Missing category identifier. Please return to the category list.';
      this.isLoading = false;
      return;
    }

    this.fetchCategory();
  }

  get disableSave(): boolean {
    return this.isSaving || this.categoryForm.invalid || !this.categoryForm.dirty;
  }

  get disableReset(): boolean {
    return this.isSaving || !this.categoryForm.dirty;
  }

  async fetchCategory(): Promise<void> {
    try {
      this.isLoading = true;
      this.loadError = null;
      this.serverMessage = '';

      const token = localStorage.getItem('TOKEN') ?? '';
      const response = await axios.get<CategoryDetailResponse>(
        `${environment.server_url}/admin/categories/${this.categoryId}`,
        { headers: { Authorization: token } }
      );

      const category = response.data?.data?.category;

      if (!category) {
        throw new Error(response.data?.message || 'Category not found');
      }

      this.serverMessage = response.data?.message || 'Category detail retrieved successfully.';
      this.lastSyncedAt = new Date();
      this.categoryData = category;
      this.categoryForm.patchValue({
        name: category.category_name || '',
        description: category.description || ''
      });
      this.categoryForm.markAsPristine();
      this.initialFormValue = this.categoryForm.getRawValue();
    } catch (error: any) {
      console.error('Error loading category:', error);
      const status = error.response?.status;
      if (status === 401) {
        localStorage.removeItem('TOKEN');
        this.popupService.AlertErrorDialog('Session expired. Please log in again.', 'Unauthorized');
        this.router.navigate(['/admin/login']);
        return;
      }
      if (status === 403) {
        this.loadError =
          error.response?.data?.message || 'You do not have permission to edit this category.';
        return;
      }
      if (status === 404) {
        this.loadError = 'Category not found or already removed.';
        return;
      }
      this.loadError = error.response?.data?.message || error.message || 'Failed to load category details';
    } finally {
      this.isLoading = false;
    }
  }

  async saveChanges(): Promise<void> {
    if (this.categoryForm.invalid || !this.categoryId) {
      this.categoryForm.markAllAsTouched();
      return;
    }

    try {
      this.isSaving = true;
      const token = localStorage.getItem('TOKEN') ?? '';
      const payload = this.buildPayload();

      const response = await axios.post<UpdateCategoryResponse>(
        `${environment.server_url}/admin/categories/${this.categoryId}`,
        payload,
        { headers: { Authorization: token } }
      );

      if (!response.data?.status) {
        const message = response.data?.message || 'Failed to update category';
        this.popupService.AlertErrorDialog(message, 'Update failed');
        return;
      }

      const successMessage = response.data?.message || 'Category updated successfully';
      const updatedCategory = response.data?.data?.category;

      if (updatedCategory) {
        this.categoryData = updatedCategory;
        this.categoryForm.patchValue({
          name: updatedCategory.category_name || '',
          description: updatedCategory.description || ''
        });
        this.categoryForm.markAsPristine();
        this.initialFormValue = this.categoryForm.getRawValue();
        this.lastSyncedAt = new Date();
      } else {
        await this.fetchCategory();
      }

      this.serverMessage = successMessage;
      this.popupService.AlertSuccessDialog(successMessage, 'Success');
    } catch (error: any) {
      console.error('Error updating category:', error);
      if (error.response?.status === 401) {
        this.popupService.AlertErrorDialog('Session expired. Please log in again.', 'Unauthorized');
        localStorage.removeItem('TOKEN');
        this.router.navigate(['/admin/login']);
        return;
      }
      if (error.response?.status === 403) {
        this.popupService.AlertErrorDialog(
          error.response?.data?.message || 'Updating this category is not allowed',
          'Forbidden'
        );
        return;
      }
      this.popupService.AlertErrorDialog(
        error.response?.data?.message || 'Failed to update category',
        'Error'
      );
    } finally {
      this.isSaving = false;
    }
  }

  refresh(): void {
    if (!this.isLoading) {
      this.fetchCategory();
    }
  }

  resetChanges(): void {
    if (!this.initialFormValue) {
      return;
    }
    this.categoryForm.reset(this.initialFormValue);
    this.categoryForm.markAsPristine();
  }

  goBack(): void {
    this.router.navigate(['/admin/categories']);
  }

  controlInvalid(controlName: string): boolean {
    const control = this.categoryForm.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  formatDate(dateString?: string): string {
    if (!dateString) {
      return '—';
    }
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  }

  private buildPayload(): Record<string, unknown> {
    const value = this.categoryForm.value;
    const payload: Record<string, unknown> = {};

    if (typeof value['name'] !== 'undefined') {
      payload['category_name'] = value['name']?.trim();
    }
    if (typeof value['description'] !== 'undefined') {
      payload['description'] = value['description']?.trim() || null;
    }

    return payload;
  }
}











