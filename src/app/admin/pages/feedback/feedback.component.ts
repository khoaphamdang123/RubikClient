import { Component, ElementRef, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import axios from 'axios';
import Swal from 'sweetalert2';
import { environment } from '../../../../environments/environment';
import { PopupService } from '../../../../services/popup.service';

interface FeedbackUser {
  _id: number;
  username: string;
  display_name?: string;
  email: string;
}

interface FeedbackCategoryInfo {
  _id?: number;
  category_name?: string;
}

interface Feedback {
  _id: number;
  subject?: string;
  feedback_content: string;
  feedback_response?: string | null;
  user_id: number;
  user?: FeedbackUser | null;
  category_id?: number;
  category_name?: string;
  category?: FeedbackCategoryInfo | null;
  status?: string;
  created_at?: string;
  updated_at?: string;
  created_date?: string;
  updated_date?: string;
}

interface PaginationData {
  currentPage: number;
  totalPages: number;
  totalFeedback: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface FeedbackResponse {
  status: boolean;
  message: string;
  data: {
    feedback: Feedback[];
    pagination: PaginationData;
  };
}

type ColumnKey =
  | 'id'
  | 'subject'
  | 'user'
  | 'category'
  | 'status'
  | 'content'
  | 'response'
  | 'created'
  | 'updated'
  | 'actions';

@Component({
  selector: 'app-feedback',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './feedback.component.html',
  styleUrl: './feedback.component.scss'
})
export class FeedbackComponent implements OnInit {
  feedbackList: Feedback[] = [];
  pagination: PaginationData | null = null;
  isLoading = false;
  error: string | null = null;
  deletingId: number | null = null;

  // Search and filters
  searchTerm = '';

  // Pagination
  currentPage = 1;
  pageSize = 10;
  pageSizeOptions = [10, 20, 50, 100];

  columns: Array<{ label: string; value: ColumnKey }> = [
    { label: 'ID', value: 'id' },
    { label: 'Subject', value: 'subject' },
    { label: 'User', value: 'user' },
    { label: 'Category', value: 'category' },
    { label: 'Status', value: 'status' },
    { label: 'Content', value: 'content' },
    { label: 'Response', value: 'response' },
    { label: 'Created', value: 'created' },
    { label: 'Updated', value: 'updated' },
    { label: 'Actions', value: 'actions' }
  ];

  // Column visibility
  columnVisibility: Record<ColumnKey, boolean> = {
    id: true,
    subject: true,
    user: true,
    category: true,
    status: true,
    content: true,
    response: true,
    created: true,
    updated: true,
    actions: true
  };

  selectedColumns: ColumnKey[] = [
    'id',
    'subject',
    'user',
    'category',
    'status',
    'content',
    'response',
    'created',
    'updated',
    'actions'
  ];
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

  ngOnInit(): void {
    this.loadFeedback();
  }

  async loadFeedback(): Promise<void> {
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
      const response = await axios.get<FeedbackResponse>(
        `${environment.server_url}/admin/feedback?${params.toString()}`,
        { headers: { 'Authorization': authHeader } }
      );

      if (response.data.status && response.data.data) {
        this.feedbackList = response.data.data.feedback;
        this.pagination = response.data.data.pagination;
      } else {
        this.error = response.data.message || 'Failed to load feedback';
        this.feedbackList = [];
        this.pagination = null;
      }
    } catch (error: any) {
      console.error('Error loading feedback:', error);
      if (error.response?.status === 401) {
        this.popupService.AlertErrorDialog('Unauthorized access', 'Error');
        localStorage.removeItem('TOKEN');
        window.location.href = '/admin/login';
      } else {
        this.error = error.response?.data?.message || 'Failed to load feedback';
        this.popupService.AlertErrorDialog(this.error ?? 'Failed to load feedback', 'Error');
      }
      this.feedbackList = [];
      this.pagination = null;
    } finally {
      this.isLoading = false;
    }
  }

  onSearch(): void {
    this.currentPage = 1; // Reset to first page on new search
    this.loadFeedback();
  }

  onPageSizeChange(): void {
    this.currentPage = 1; // Reset to first page on page size change
    this.loadFeedback();
  }

  goToPage(page: number): void {
    if (page >= 1 && this.pagination && page <= this.pagination.totalPages) {
      this.currentPage = page;
      this.loadFeedback();
      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  getPageNumbers(): number[] {
    if (!this.pagination) return [];

    const totalPages = this.pagination.totalPages;
    const current = this.currentPage;
    const pages: number[] = [];

    if (totalPages <= 7) {
      // Show all pages if 7 or fewer
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show first page
      pages.push(1);

      if (current > 3) {
        pages.push(-1); // Ellipsis
      }

      // Show pages around current
      const start = Math.max(2, current - 1);
      const end = Math.min(totalPages - 1, current + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (current < totalPages - 2) {
        pages.push(-1); // Ellipsis
      }

      // Show last page
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

  refreshFeedback(): void {
    this.loadFeedback();
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
    // Calculate row number based on current page and index
    // Row number = (currentPage - 1) * pageSize + index + 1
    return (this.currentPage - 1) * this.pageSize + index + 1;
  }

  truncateText(text: string | null | undefined, maxLength: number = 100): string {
    if (!text) return '—';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '…';
  }

  getSubjectDisplay(feedback: Feedback): string {
    return feedback.subject?.trim() || 'Untitled feedback';
  }

  getUserDisplayName(feedback: Feedback): string {
    if (feedback.user) {
      return feedback.user.display_name || feedback.user.username || 'Unknown User';
    }
    return 'Unknown User';
  }

  getUserEmail(feedback: Feedback): string {
    return feedback.user?.email || '—';
  }

  getCategoryLabel(feedback: Feedback): string {
    return (
      feedback.category_name ||
      feedback.category?.category_name ||
      (feedback.category_id !== undefined && feedback.category_id !== null
        ? `#${feedback.category_id}`
        : 'Uncategorized')
    );
  }

  getStatusLabel(feedback: Feedback): string {
    return feedback.status?.trim() || 'Pending';
  }

  getStatusChipClass(feedback: Feedback): string {
    const normalized = this.getStatusLabel(feedback).toLowerCase();

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

  onEditFeedback(feedback: Feedback): void {
    this.router.navigate(['/admin/feedback', feedback._id, 'edit']);
  }

  async onDeleteFeedback(feedback: Feedback): Promise<void> {
    const confirmation = await Swal.fire({
      title: 'Delete feedback?',
      text: `This will permanently remove feedback #${feedback._id}.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626'
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    try {
      this.deletingId = feedback._id;
      const token = localStorage.getItem('TOKEN') ?? '';
      await axios.delete(`${environment.server_url}/admin/feedback/${feedback._id}`, {
        headers: { Authorization: token }
      });

      this.popupService.AlertSuccessDialog('Feedback deleted successfully.', 'Feedback');
      this.loadFeedback();
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to delete feedback.';
      this.popupService.AlertErrorDialog(message, 'Feedback');
    } finally {
      this.deletingId = null;
    }
  }
}






