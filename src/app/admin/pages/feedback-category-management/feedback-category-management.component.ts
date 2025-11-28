import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import axios from 'axios';
import { environment } from '../../../../environments/environment';
import { PopupService } from '../../../../services/popup.service';

interface FeedbackCategory {
  _id?: number | string;
  id?: number | string;
  category_name: string;
  created_date?: string;
  updated_date?: string;
}

interface FeedbackCategoryResponsePayload {
  categories?: FeedbackCategory[];
  pagination?: FeedbackCategoryPaginationPayload;
}

interface FeedbackCategoryResponse {
  status: boolean;
  message: string;
  data?: FeedbackCategoryResponsePayload;
}

interface FeedbackCategoryPaginationPayload {
  currentPage?: number;
  totalPages?: number;
  totalCategories?: number;
  limit?: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
}

interface FeedbackCategoryPagination {
  currentPage: number;
  totalPages: number;
  totalCategories: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

type FeedbackCategoryColumnKey = 'id' | 'category' | 'created' | 'updated';
type ColumnVisibility = Record<FeedbackCategoryColumnKey, boolean> & { actions: boolean };

@Component({
  selector: 'app-feedback-category-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './feedback-category-management.component.html',
  styleUrls: ['./feedback-category-management.component.scss']
})
export class FeedbackCategoryManagementComponent implements OnInit {
  categories: FeedbackCategory[] = [];
  pagination: FeedbackCategoryPagination | null = null;
  isLoading = false;
  error: string | null = null;

  searchTerm = '';
  currentPage = 1;
  pageSize = 10;
  pageSizeOptions = [10, 20, 50, 100];

  columns: Array<{ label: string; value: FeedbackCategoryColumnKey }> = [
    { label: 'ID', value: 'id' },
    { label: 'Category', value: 'category' },
    { label: 'Created', value: 'created' },
    { label: 'Updated', value: 'updated' }
  ];

  columnVisibility: ColumnVisibility = {
    id: true,
    category: true,
    created: true,
    updated: true,
    actions: true
  };

  selectedColumns: FeedbackCategoryColumnKey[] = ['id', 'category', 'created', 'updated'];
  isColumnDropdownOpen = false;

  constructor(
    private readonly popupService: PopupService,
    private readonly elementRef: ElementRef,
    private readonly router: Router
  ) {}

  @HostListener('document:click', ['$event'])
  handleDocumentClick(event: Event): void {
    if (this.isColumnDropdownOpen && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.closeColumnDropdown();
    }
  }

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    this.closeColumnDropdown();
  }

  ngOnInit(): void {
    this.loadFeedbackCategories();
  }

  async loadFeedbackCategories(): Promise<void> {
    const token = this.getAuthorizationToken();
    if (!token) {
      return;
    }

    this.isLoading = true;
    this.error = null;

    try {
      const params = new URLSearchParams();
      params.append('page', this.currentPage.toString());
      params.append('limit', this.pageSize.toString());
      if (this.searchTerm.trim()) {
        params.append('search', this.searchTerm.trim());
      }

      const response = await axios.get<FeedbackCategoryResponse>(
        `${environment.server_url}/admin/feedback-categories?${params.toString()}`,
        { headers: { Authorization: token } }
      );

      if (response.data.status && response.data.data?.categories) {
        const list = response.data.data.categories;
        this.categories = Array.isArray(list) ? list : [];
        this.pagination = this.normalizePagination(response.data.data.pagination, list.length);
      } else {
        this.error = response.data.message || 'Failed to load feedback categories';
        this.categories = [];
        this.pagination = null;
      }
    } catch (error: any) {
      console.error('Failed to load feedback categories', error);
      if (error?.response?.status === 401) {
        this.handleUnauthorized();
        return;
      }
      this.error = error?.response?.data?.message || error?.message || 'Failed to load feedback categories';
      this.categories = [];
      this.pagination = null;
    } finally {
      this.isLoading = false;
    }
  }

  onSearch(): void {
    this.currentPage = 1;
    this.loadFeedbackCategories();
  }

  clearSearch(): void {
    if (!this.searchTerm.trim()) {
      return;
    }
    this.searchTerm = '';
    this.onSearch();
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
    this.loadFeedbackCategories();
  }

  refreshCategories(): void {
    this.loadFeedbackCategories();
  }

  navigateToCreate(): void {
    this.router.navigate(['/admin/feedback-categories/create']);
  }

  goToPage(page: number): void {
    if (!this.pagination) {
      return;
    }
    if (page < 1 || page > this.pagination.totalPages) {
      return;
    }
    this.currentPage = page;
    this.loadFeedbackCategories();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  getPageNumbers(): number[] {
    if (!this.pagination) {
      return [];
    }

    const totalPages = this.pagination.totalPages;
    const current = this.currentPage;
    const pages: number[] = [];

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i += 1) {
        pages.push(i);
      }
      return pages;
    }

    pages.push(1);

    if (current > 3) {
      pages.push(-1);
    }

    const start = Math.max(2, current - 1);
    const end = Math.min(totalPages - 1, current + 1);

    for (let i = start; i <= end; i += 1) {
      pages.push(i);
    }

    if (current < totalPages - 2) {
      pages.push(-1);
    }

    pages.push(totalPages);
    return pages;
  }

  getRowNumber(index: number): number {
    return (this.currentPage - 1) * this.pageSize + index + 1;
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

  onColumnOptionToggle(columnValue: FeedbackCategoryColumnKey, checked: boolean): void {
    const isOnlyColumnSelected =
      !checked && this.selectedColumns.length === 1 && this.selectedColumns.includes(columnValue);

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

  formatDate(value?: string): string {
    if (!value) {
      return 'Unknown';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Unknown';
    }
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  viewFeedbackForCategory(category: FeedbackCategory): void {
    if (!category?.category_name) {
      return;
    }
    this.router.navigate(['/admin/feedback'], {
      queryParams: { category: category.category_name }
    });
  }

  private updateSelectedColumns(): void {
    this.selectedColumns = this.columns
      .filter(column => this.columnVisibility[column.value])
      .map(column => column.value);
  }

  private closeColumnDropdown(): void {
    this.isColumnDropdownOpen = false;
  }

  private normalizePagination(
    payload: FeedbackCategoryPaginationPayload | undefined,
    fallbackTotal: number
  ): FeedbackCategoryPagination {
    const currentPage = payload?.currentPage ?? this.currentPage;
    const limit = payload?.limit ?? this.pageSize;
    const totalCategories = payload?.totalCategories ?? fallbackTotal;
    const totalPages = payload?.totalPages ?? Math.max(1, Math.ceil(totalCategories / Math.max(limit, 1)));

    return {
      currentPage,
      totalPages,
      totalCategories,
      limit,
      hasNextPage: payload?.hasNextPage ?? currentPage < totalPages,
      hasPrevPage: payload?.hasPrevPage ?? currentPage > 1
    };
  }

  private getAuthorizationToken(): string | null {
    const token = localStorage.getItem('TOKEN');
    if (!token) {
      this.popupService.AlertErrorDialog('Missing admin token. Please sign in again.', 'Authorization required');
      this.router.navigate(['/admin/login']);
      return null;
    }
    return token;
  }

  private handleUnauthorized(): void {
    this.popupService.AlertErrorDialog('Session expired. Please login again.', 'Unauthorized');
    localStorage.removeItem('TOKEN');
    this.router.navigate(['/admin/login']);
  }
}


