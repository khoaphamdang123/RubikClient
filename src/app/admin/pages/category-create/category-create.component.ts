import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import axios from 'axios';
import Swal from 'sweetalert2';
import { environment } from '../../../../environments/environment';
import { PopupService } from '../../../../services/popup.service';

interface CreateCategoryResponse {
  status: boolean;
  message: string;
  data?: {
    category: {
      _id: string;
      category_name: string;
      created_date?: string;
      updated_date?: string;
    };
  };
}

@Component({
  selector: 'app-category-create',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './category-create.component.html',
  styleUrl: './category-create.component.scss'
})
export class CategoryCreateComponent {
  categoryName = '';
  isSaving = false;
  error: string | null = null;

  constructor(
    private router: Router,
    private popupService: PopupService
  ) {}

  async createCategory(): Promise<void> {
    const trimmedName = this.categoryName.trim();
    if (!trimmedName) {
      this.error = 'Category name is required';
      this.popupService.AlertErrorDialog(this.error, 'Validation Error');
      return;
    }

    this.isSaving = true;
    this.error = null;

    try {
      // Prepare timestamps for creation
      const nowIso = new Date().toISOString();

      const token = localStorage.getItem('TOKEN');
      const authHeader: string = token ? token : '';

      const response = await axios.post<CreateCategoryResponse>(
        `${environment.server_url}/admin/categories`,
        {
          category_name: trimmedName,
          created_date: nowIso,
          updated_date: nowIso
        },
        { headers: { Authorization: authHeader } }
      );

      if (response.data.status) {
        const successMsg = response.data.message || 'Category created successfully';
        this.popupService.AlertSuccessDialog(successMsg, 'Success');

        await Swal.fire({
          icon: 'success',
          title: 'Category Created',
          text: successMsg,
          confirmButtonText: 'OK'
        });

        //this.router.navigate(['/admin/categories']);
      } else {
        const msg = response.data.message || 'Failed to create category';
        this.error = msg;
        this.popupService.AlertErrorDialog(msg, 'Error');
      }
    } catch (error: any) {
      console.error('Error creating category:', error);

      if (error.response?.status === 401) {
        this.popupService.AlertErrorDialog('Unauthorized access', 'Error');
        localStorage.removeItem('TOKEN');
        window.location.href = '/admin/login';
      } else if (error.response?.status === 409) {
        const msg = error.response?.data?.message || 'Category name already exists';
        this.error = msg;
        this.popupService.AlertErrorDialog(msg, 'Conflict');
      } else if (error.response?.status === 400) {
        const msg = error.response?.data?.message || 'category_name is required';
        this.error = msg;
        this.popupService.AlertErrorDialog(msg, 'Validation Error');
      } else {
        const msg = error.response?.data?.message || 'Failed to create category';
        this.error = msg;
        this.popupService.AlertErrorDialog(msg, 'Error');
      }
    } finally {
      this.isSaving = false;
    }
  }

  cancel(): void {
    this.router.navigate(['/admin/categories']);
  }
}


