import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import axios from 'axios';
import Swal from 'sweetalert2';
import { environment } from '../../../../environments/environment';
import { PopupService } from '../../../../services/popup.service';

interface RubikType {
  _id?: string;
  id?: string | number;
  type_name: string;
  description?: string;
  variation?: number | string;
  created_at?: string;
  updated_at?: string;
  created_date?: string;
  updated_date?: string;
}

interface RubikTypeListResponse {
  status: boolean;
  message: string;
  data?: {
    rubikTypes?: RubikType[];
    pagination?: RubikTypePaginationPayload;
  };
}

interface RubikTypePaginationPayload {
  currentPage?: number;
  totalPages?: number;
  totalRubikTypes?: number;
  limit?: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
}

interface RubikTypePagination {
  currentPage: number;
  totalPages: number;
  totalRubikTypes: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

type RubikTypeColumnKey = 'id' | 'type' | 'variation' | 'created' | 'updated';

@Component({
  selector: 'app-rubik-type-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rubik-type-management.component.html',
  styleUrls: ['./rubik-type-management.component.scss']
})
export class RubikTypeManagementComponent implements OnInit {
  rubikTypes: RubikType[] = [];
  pagination: RubikTypePagination | null = null;
  isLoading = false;
  error: string | null = null;

  searchTerm = '';

  currentPage = 1;
  pageSize = 10;
  pageSizeOptions = [10, 20, 50, 100];

  columns: Array<{ label: string; value: RubikTypeColumnKey }> = [
    { label: 'ID', value: 'id' },
    { label: 'Rubik Type', value: 'type' },
    { label: 'Variations', value: 'variation' },
    { label: 'Created', value: 'created' },
    { label: 'Updated', value: 'updated' }
  ];

  columnVisibility: Record<RubikTypeColumnKey, boolean> & { actions: boolean } = {
    id: true,
    type: true,
    variation: true,
    created: true,
    updated: true,
    actions: true
  };

  selectedColumns: RubikTypeColumnKey[] = ['id', 'type', 'variation', 'created', 'updated'];
  isColumnDropdownOpen = false;

  isDeletingId: string | number | null = null;

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
    this.loadRubikTypes();
  }

  async loadRubikTypes(): Promise<void> {
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

      const response = await axios.get<RubikTypeListResponse>(
        `${environment.server_url}/admin/rubik-types?${params.toString()}`,
        {
          headers: { Authorization: token }
        }
      );

      if (response.data.status && response.data.data?.rubikTypes) {
        const list = response.data.data.rubikTypes;
        this.rubikTypes = Array.isArray(list) ? list : [];
        this.pagination = this.normalizePagination(response.data.data.pagination, list.length);
      } else {
        this.error = response.data.message || 'Failed to load rubik types';
        this.rubikTypes = [];
        this.pagination = null;
      }
    } catch (error: any) {
      console.error('Failed to load rubik types', error);
      if (error?.response?.status === 401) {
        this.handleUnauthorized();
        return;
      }
      this.error = error?.response?.data?.message || error?.message || 'Failed to load rubik types';
      this.rubikTypes = [];
      this.pagination = null;
    } finally {
      this.isLoading = false;
    }
  }

  onSearch(): void {
    this.currentPage = 1;
    this.loadRubikTypes();
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
    this.loadRubikTypes();
  }

  refreshRubikTypes(): void {
    this.loadRubikTypes();
  }

  goToPage(page: number): void {
    if (!this.pagination) {
      return;
    }
    if (page < 1 || page > this.pagination.totalPages) {
      return;
    }
    this.currentPage = page;
    this.loadRubikTypes();
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

  onColumnOptionToggle(columnValue: RubikTypeColumnKey, checked: boolean): void {
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

  navigateToCreate(): void {
    this.router.navigate(['/admin/rubik-types/create']);
  }

  async deleteRubikType(rubikType: RubikType): Promise<void> {
    const identifier = this.getRubikTypeIdentifier(rubikType);
    if (identifier === null) {
      this.popupService.AlertErrorDialog('Unable to determine rubik type ID.', 'Rubik Type');
      return;
    }

    const confirmation = await Swal.fire({
      title: 'Delete rubik type?',
      text: `You are about to delete "${rubikType.type_name || identifier}". This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel',
      reverseButtons: true
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    const token = this.getAuthorizationToken();
    if (!token) {
      return;
    }

    this.isDeletingId = identifier;

    try {
      const response = await axios.get<{ status: boolean; message: string }>(
        `${environment.server_url}/admin/rubik-types/${identifier}/delete`,
        {
          headers: { Authorization: token }
        }
      );

      if (response.data.status) {
        this.popupService.AlertSuccessDialog(response.data.message || 'Rubik type deleted successfully', 'Success');
        await this.loadRubikTypes();
      } else {
        this.popupService.AlertErrorDialog(response.data.message || 'Failed to delete rubik type', 'Rubik Type');
      }
    } catch (error: any) {
      console.error('Failed to delete rubik type', error);
      if (error?.response?.status === 401) {
        this.handleUnauthorized();
        return;
      }
      const message = error?.response?.data?.message || error?.message || 'Failed to delete rubik type';
      this.popupService.AlertErrorDialog(message, 'Rubik Type');
    } finally {
      this.isDeletingId = null;
    }
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

  truncateText(value: string | undefined, limit = 120): string {
    if (!value) {
      return '—';
    }
    const trimmed = value.trim();
    if (trimmed.length <= limit) {
      return trimmed;
    }
    return `${trimmed.slice(0, limit).trim()}…`;
  }

  normalizeVariationInput(value: number | string | null | undefined): number | null {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      return value;
    }

    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed >= 0) {
        return parsed;
      }
    }

    return null;
  }

  private normalizePagination(
    payload: RubikTypePaginationPayload | undefined,
    fallbackTotal: number
  ): RubikTypePagination {
    const currentPage = payload?.currentPage ?? this.currentPage;
    const limit = payload?.limit ?? this.pageSize;
    const totalRubikTypes = payload?.totalRubikTypes ?? fallbackTotal;
    const totalPages = payload?.totalPages ?? Math.max(1, Math.ceil(totalRubikTypes / Math.max(limit, 1)));

    return {
      currentPage,
      totalPages,
      totalRubikTypes,
      limit,
      hasNextPage: payload?.hasNextPage ?? currentPage < totalPages,
      hasPrevPage: payload?.hasPrevPage ?? currentPage > 1
    };
  }

  private updateSelectedColumns(): void {
    this.selectedColumns = this.columns.filter(column => this.columnVisibility[column.value]).map(column => column.value);
  }

  private closeColumnDropdown(): void {
    this.isColumnDropdownOpen = false;
  }

  private getRubikTypeIdentifier(rubikType: RubikType | null): string | number | null {
    if (!rubikType) {
      return null;
    }
    if (rubikType._id) {
      return rubikType._id;
    }
    if (rubikType.id !== undefined && rubikType.id !== null) {
      return rubikType.id;
    }
    return null;
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


