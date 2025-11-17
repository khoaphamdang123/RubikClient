import { Component, ElementRef, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PopupService } from '../../../../services/popup.service';
import Swal from 'sweetalert2';
import axios from 'axios';
import { environment } from '../../../../environments/environment';

interface Category {
  _id?: string;
  category_name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  created_date?: string;
  updated_date?: string;
}

interface PaginationData {
  currentPage: number;
  totalPages: number;
  totalCategories: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface CategoriesResponse {
  status: boolean;
  message: string;
  data: {
    categories: Category[];
    pagination: PaginationData;
  };
}

interface DeleteCategoryResponse {
  status: boolean;
  message: string;
}

type ColumnKey = 'id' | 'name' | 'created_date';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './categories.component.html',
  styleUrl: './categories.component.scss'
})
export class CategoriesComponent implements OnInit {
  categories: Category[] = [];
  pagination: PaginationData | null = null;
  isLoading = false;
  error: string | null = null;

  // Search
  searchTerm = '';

  // Pagination
  currentPage = 1;
  pageSize = 10;
  pageSizeOptions = [10, 20, 50, 100];

  columns: Array<{ label: string; value: ColumnKey }> = [
    { label: 'ID', value: 'id' },
    { label: 'Name', value: 'name' },
    { label: 'Created At', value: 'created_date' }
  ];

  // Column visibility
  columnVisibility: Record<ColumnKey, boolean> & { actions: boolean } = {
    id: true,
    name: true,
    created_date: true,
    actions: true
  };

  selectedColumns: ColumnKey[] = ['id', 'name', 'created_date'];
  isColumnDropdownOpen = false;

  constructor(
    private popupService: PopupService,
    private elementRef: ElementRef,
    private router: Router
  ) {}

  @HostListener('document:click', ['$event'])  
  handleDocumentClick(event: Event): void {
    if (
      this.isColumnDropdownOpen &&
      !this.elementRef.nativeElement.contains(event.target as Node)
    ) {
      this.closeColumnDropdown();      
    }
  }

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    this.closeColumnDropdown();
  }

  ngOnInit(): void 
  {
    this.loadCategories();
  }

  async loadCategories(): Promise<void> {
    try {
      this.isLoading = true;
      this.error = null;

      const token = localStorage.getItem('TOKEN');
      const params = new URLSearchParams();
      params.append('page', this.currentPage.toString());
      params.append('limit', this.pageSize.toString());

      if (this.searchTerm.trim()) {
        params.append('search', this.searchTerm.trim());
      }

      const authHeader: string = token ? token : '';
      const response = await axios.get<CategoriesResponse>(
        `${environment.server_url}/admin/categories?${params.toString()}`,
        { headers: { Authorization: authHeader } }
      );

      if (response.data.status && response.data.data) 
      {
        this.categories = response.data.data.categories;
        this.pagination = response.data.data.pagination;
      } else {
        this.error = response.data.message || 'Failed to load categories';
        this.categories = [];
        this.pagination = null;
      }
    } catch (error: any) {
      console.error('Error loading categories:', error);
      if (error.response?.status === 401) {
        this.popupService.AlertErrorDialog('Unauthorized access', 'Error');
        localStorage.removeItem('TOKEN');
        window.location.href = '/admin/login';        
      } else {
        this.error = error.response?.data?.message || 'Failed to load categories';
        this.popupService.AlertErrorDialog(this.error ?? 'Failed to load categories', 'Error');
      }
      this.categories = [];
      this.pagination = null;
    } finally {
      this.isLoading = false;      
    }
  }

  onSearch(): void {
    this.currentPage = 1;
    this.loadCategories();
  }

  onPageSizeChange(): void 
  {
    this.currentPage = 1;
    this.loadCategories();    
  }

  goToPage(page: number): void {
    if (page >= 1 && this.pagination && page <= this.pagination.totalPages) {
      this.currentPage = page;
      this.loadCategories();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  getPageNumbers(): number[] {
    if (!this.pagination) return [];

    const totalPages = this.pagination.totalPages;
    const current = this.currentPage;
    const pages: number[] = [];    

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {

      pages.push(1);

      if (current > 3) {
        pages.push(-1); // Ellipsis
      }

      const start = Math.max(2, current - 1);
      
      const end = Math.min(totalPages - 1, current + 1);

      for (let i = start; i <= end; i++) 
      {
        pages.push(i);
      }

      if (current < totalPages - 2) 
      {
        pages.push(-1);         
      }

      pages.push(totalPages);
    }

    return pages;
  }

  formatDate(dateString?: string): string {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  }

  async deleteCategory(category: Category): Promise<void> {
    const result = await Swal.fire({
      title: 'Confirm Delete',
      text: `Are you sure you want to delete category "${category.category_name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    });

    if (!result.isConfirmed) return;

    try {
      const token = localStorage.getItem('TOKEN');
      const categoryId = category._id;
      if (!categoryId) {
        this.popupService.AlertErrorDialog('Category ID not found', 'Error');
        return;
      }

      const authHeader: string = token ? token : '';
      const response = await axios.get<DeleteCategoryResponse>(
        `${environment.server_url}/admin/categories/${categoryId}/delete`,
        { headers: { Authorization: authHeader } }
      );

      if (response.data.status) {
        this.popupService.AlertSuccessDialog(
          response.data.message || 'Category deleted successfully',
          'Success'
        );
        await this.loadCategories();
      } else {
        const message = response.data.message || 'Failed to delete category';
        this.popupService.AlertErrorDialog(message, 'Error');
      }
    } catch (error: any) {
      console.error('Error deleting category:', error);
      if (error.response?.status === 401) {
        this.popupService.AlertErrorDialog('Unauthorized access', 'Error');
        localStorage.removeItem('TOKEN');
        window.location.href = '/admin/login';
      } else {
        this.popupService.AlertErrorDialog(
          error.response?.data?.message || 'Failed to delete category',
          'Error'
        );
      }
    }
  }

  refreshCategories(): void {
    this.loadCategories();
  }

  get selectedColumnsLabel(): string {
    if (this.selectedColumns.length === this.columns.length) {
      return 'Showing all columns';
    }

    if (this.selectedColumns.length === 0) {
      return 'No columns selected';
    }

    if (this.selectedColumns.length <= 2) {
      return this.columns
        .filter(column => this.selectedColumns.includes(column.value))
        .map(column => column.label)
        .join(', ');
    }

    return `${this.selectedColumns.length} columns visible`;
  }

  toggleColumnDropdown(event?: MouseEvent): void {
    event?.stopPropagation();
    this.isColumnDropdownOpen = !this.isColumnDropdownOpen;
  }

  onColumnOptionToggle(columnValue: ColumnKey, checked: boolean): void {
    const isOnlyColumnSelected =
      !checked &&
      this.selectedColumns.length === 1 &&
      this.selectedColumns.includes(columnValue);

    if (isOnlyColumnSelected) {
      return;
    }

    this.columnVisibility[columnValue] = checked;
    this.updateSelectedColumns();
  }

  resetColumnSelection(): void {
    this.columns.forEach(column => {
      this.columnVisibility[column.value] = true;
    });
    this.updateSelectedColumns();
    this.closeColumnDropdown();
  }

  private closeColumnDropdown(): void {
    this.isColumnDropdownOpen = false;
  }

  private updateSelectedColumns(): void {
    this.selectedColumns = this.columns
      .filter(column => this.columnVisibility[column.value])
      .map(column => column.value);
  }

  getRowNumber(index: number): number {
    return (this.currentPage - 1) * this.pageSize + index + 1;
  }

  addCategory(): void {
    this.router.navigate(['/admin/categories/create']);
  }

  editCategory(category: Category): void {
    const categoryId = category._id;
    if (!categoryId) return;
    this.router.navigate(['/admin/categories', categoryId, 'edit']);
  }
}

