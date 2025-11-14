import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { PopupService } from '../../../../services/popup.service';
import Swal from 'sweetalert2';
import axios from 'axios';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './categories.component.html',
  styleUrl: './categories.component.scss'
})
export class CategoriesComponent implements OnInit {
  categories: any[] = [];
  filteredCategories: any[] = [];
  isLoading = false;
  isModalOpen = false;
  isEditMode = false;
  selectedCategory: any = null;
  searchTerm = '';

  categoryForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private popupService: PopupService
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    this.loadCategories();
  }

  initForm(): void {
    this.categoryForm = this.fb.group({
      name: new FormControl('', [Validators.required]),
      description: new FormControl(''),
      icon: new FormControl('')
    });
  }

  async loadCategories(): Promise<void> {
    try {
      this.isLoading = true;
      const token = localStorage.getItem('TOKEN');
      const response = await axios.get(`${environment.server_url}/admin/categories`, {
        headers: { 'Authorization': token }
      });
      this.categories = response.data || [];
      this.filteredCategories = [...this.categories];
    } catch (error: any) {
      console.error('Error loading categories:', error);
      if (error.response?.status === 401) {
        this.popupService.AlertErrorDialog('Unauthorized access', 'Error');
        localStorage.removeItem('TOKEN');
        window.location.href = '/login';
      } else {
        // Fallback: use mock data or empty array
        this.categories = [];
        this.filteredCategories = [];
      }
    } finally {
      this.isLoading = false;
    }
  }

  onSearch(): void {
    if (!this.searchTerm.trim()) {
      this.filteredCategories = [...this.categories];
      return;
    }

    const term = this.searchTerm.toLowerCase();
    this.filteredCategories = this.categories.filter(category =>
      category.name?.toLowerCase().includes(term) ||
      category.description?.toLowerCase().includes(term)
    );
  }

  openAddModal(): void {
    this.isEditMode = false;
    this.selectedCategory = null;
    this.categoryForm.reset();
    this.isModalOpen = true;
  }

  openEditModal(category: any): void {
    this.isEditMode = true;
    this.selectedCategory = category;
    this.categoryForm.patchValue({
      name: category.name,
      description: category.description || '',
      icon: category.icon || ''
    });
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.isEditMode = false;
    this.selectedCategory = null;
    this.categoryForm.reset();
  }

  async onSubmit(): Promise<void> {
    if (!this.categoryForm.valid) {
      this.categoryForm.markAllAsTouched();
      return;
    }

    try {
      const token = localStorage.getItem('TOKEN');
      const formValue = this.categoryForm.value;

      if (this.isEditMode && this.selectedCategory?.id) {
        // Update category
        await axios.put(
          `${environment.server_url}/admin/categories/${this.selectedCategory.id}`,
          formValue,
          { headers: { 'Authorization': token } }
        );
        this.popupService.AlertSuccessDialog('Category updated successfully', 'Success');
      } else {
        // Create category
        await axios.post(
          `${environment.server_url}/admin/categories`,
          formValue,
          { headers: { 'Authorization': token } }
        );
        this.popupService.AlertSuccessDialog('Category created successfully', 'Success');
      }

      this.closeModal();
      await this.loadCategories();
    } catch (error: any) {
      console.error('Error saving category:', error);
      this.popupService.AlertErrorDialog(
        error.response?.data?.message || 'Failed to save category',
        'Error'
      );
    }
  }

  async deleteCategory(category: any): Promise<void> {
    const result = await Swal.fire({
      title: 'Confirm Delete',
      text: `Are you sure you want to delete category "${category.name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    });

    if (!result.isConfirmed) return;

    try {
      const token = localStorage.getItem('TOKEN');
      await axios.delete(
        `${environment.server_url}/admin/categories/${category.id}`,
        { headers: { 'Authorization': token } }
      );
      this.popupService.AlertSuccessDialog('Category deleted successfully', 'Success');
      await this.loadCategories();
    } catch (error: any) {
      console.error('Error deleting category:', error);
      this.popupService.AlertErrorDialog(
        error.response?.data?.message || 'Failed to delete category',
        'Error'
      );
    }
  }
}










