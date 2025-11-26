import { CommonModule, TitleCasePipe } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterModule } from '@angular/router';
import axios from 'axios';
import { Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PopupService } from '../../../../services/popup.service';
import { jsDocComment } from '@angular/compiler';

type RubikTypeIdentifier = number | string;

interface RubikTypeDetail {
  _id?: RubikTypeIdentifier;
  id?: RubikTypeIdentifier;
  type_name: string;
  description?: string;
  variation?: number | string;
  created_at?: string;
  updated_at?: string;
  created_date?: string;
  updated_date?: string;
  products?: RubikTypeLinkedProduct[];
  variants?: RubikTypeVariant[];
  [key: string]: unknown;
}

interface RubikTypeVariant {
  name?: string;
  description?: string;
  turn_metric?: number | string;
  [key: string]: unknown;
}

interface RubikTypeLinkedProduct {
  _id?: string;
  id?: string | number;
  name?: string;
  avatar?: string;
  status?: string;
  category_name?: string;
  [key: string]: unknown;
}

interface RubikTypeDetailResponse {
  status: boolean;
  message: string;
  data?: {
    rubikType?: RubikTypeDetail;
  };
}


interface RubikTypeListResponse {
  status: boolean;
  message: string;
  data?: {
    rubikTypes?: RubikTypeDetail[];
    pagination?: RubikTypePaginationPayload;
  };
}

interface RubikTypeMutationResponse {
  status: boolean;
  message: string;
  data?: {
    rubikType?: RubikTypeDetail;
  };
}

interface RubikTypePaginationPayload {
  currentPage?: number;
  page?: number;
  pageIndex?: number;
  totalPages?: number;
  pages?: number;
  totalRubikTypes?: number;
  totalItems?: number;
  total?: number;
  limit?: number;
  perPage?: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
}

interface RubikTypePagination {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface RubikTypeFilters {
  searchTerm: string;
  sortBy: RubikTypeSortKey;
}

interface RubikTypeFormModel {
  type_name: string;
  description: string;
  variation: number | null;
}

type RubikTypeTab = 'overview' | 'attributes' | 'linkedProducts';
type RubikTypeSortKey = 'newest' | 'oldest' | 'nameAsc' | 'nameDesc';
type RubikTypeColumnKey = 'id' | 'type' | 'description' | 'variation' | 'updated';

interface RubikTypeTabConfig {
  id: RubikTypeTab;
  label: string;
  description: string;
}

@Component({
  selector: 'app-rubik-type-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TitleCasePipe],
  templateUrl: './rubik-type-management.component.html',
  styleUrl: './rubik-type-management.component.scss'
})
export class RubikTypeManagementComponent implements OnInit, OnDestroy {
  // Table state
  rubikTypes: RubikTypeDetail[] = [];
  pagination: RubikTypePagination | null = null;
  isListLoading = false;
  listError: string | null = null;
  currentPage = 1;
  pageSize = 10;
  pageSizeOptions = [10, 20, 50, 100];
  filters: RubikTypeFilters = {
    searchTerm: '',
    sortBy: 'newest'
  };

  // Detail drawer state
  rubikType: RubikTypeDetail | null = null;
  isDetailLoading = false;
  detailError: string | null = null;
  activeTab: RubikTypeTab = 'overview';
  lastFetchedAt: Date | null = null;
  isDetailDrawerOpen = false;
  currentRubikTypeId: RubikTypeIdentifier | null = null;

  // Modal state
  isModalOpen = false;
  modalError: string | null = null;
  isModalSubmitting = false;
  editingRubikTypeId: RubikTypeIdentifier | null = null;
  rubikTypeForm: RubikTypeFormModel = {
    type_name: '',
    description: '',
    variation: null
  };

  columns: Array<{ label: string; value: RubikTypeColumnKey }> = [
    { label: 'ID', value: 'id' },
    { label: 'Rubik Type', value: 'type' },
    { label: 'Description', value: 'description' },
    { label: 'Variations', value: 'variation' },
    { label: 'Updated', value: 'updated' }
  ];

  columnVisibility: Record<RubikTypeColumnKey, boolean> & { actions: boolean } = {
    id: true,
    type: true,
    description: true,
    variation: true,
    updated: true,
    actions: true
  };

  selectedColumns: RubikTypeColumnKey[] = ['id', 'type', 'description', 'variation', 'updated'];
  isColumnDropdownOpen = false;

  private routeSubscription?: Subscription;

  tabs: RubikTypeTabConfig[] = [
    {
      id: 'overview',
      label: 'Overview',
      description: 'Type summary & health'
    },
    {
      id: 'attributes',
      label: 'Attributes',
      description: 'Raw data payload'
    },
    {
      id: 'linkedProducts',
      label: 'Linked Products',
      description: 'Products referencing this type'
    }
  ];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly popupService: PopupService,
    private readonly elementRef: ElementRef
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
    this.routeSubscription = this.route.paramMap.subscribe((params: ParamMap) => {
      const idParam = params.get('id');
      if (!idParam) {
        this.currentRubikTypeId = null;
        this.closeDetailDrawer(false);
        return;
      }

      const identifier = this.parseIdentifier(idParam);
      if (identifier === null) {
        this.detailError = 'Rubik type ID must be numeric.';
        this.popupService.AlertErrorDialog('Rubik type ID must be numeric.', 'Rubik Type');
        return;
      }

      this.currentRubikTypeId = identifier;
      this.isDetailDrawerOpen = true;
      this.fetchRubikTypeDetail(identifier);
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
  }

  async loadRubikTypes(): Promise<void> {
    const token = this.getAuthorizationToken();
    if (!token) {
      return;
    }

    this.isListLoading = true;
    this.listError = null;

    try {
      const params = new URLSearchParams({
        page: this.currentPage.toString(),
        limit: this.pageSize.toString(),
        sort: this.filters.sortBy
      });

      if (this.filters.searchTerm.trim()) {
        params.append('search', this.filters.searchTerm.trim());
      }

      const response = await axios.get<RubikTypeListResponse | RubikTypeDetail[]>(
        `${environment.server_url}/admin/rubik-types?${params.toString()}`,
        {
          headers: {
            Authorization: token
          }
        }
      );

      const normalizedPayload = this.normalizeListPayload(response.data);

      if (normalizedPayload) {
        const filtered = this.applyClientFilters(normalizedPayload.items);
        this.rubikTypes = filtered;
        this.pagination = this.normalizePagination(normalizedPayload.pagination, normalizedPayload.totalFallback);
      } else {
        this.listError = 'Failed to load rubik types';
        this.rubikTypes = [];
        this.pagination = null;
      }
    } catch (error: any) {
      console.error('Error loading rubik types:', error);
      if (error?.response?.status === 401) {
        this.handleUnauthorized();
        return;
      }
      this.listError = error?.response?.data?.message || error?.message || 'Failed to load rubik types';
      this.rubikTypes = [];
      this.pagination = null;
    } finally {
      this.isListLoading = false;
    }
  }

  async fetchRubikTypeDetail(id: RubikTypeIdentifier): Promise<void> {
    if (id === null || id === undefined) {
      return;      
    }

    const token = this.getAuthorizationToken();

    if (!token) {
      return;
    }

    this.isDetailLoading = true;

    this.detailError = null;

    try {
      const response = await axios.get<RubikTypeDetailResponse>(
        `${environment.server_url}/admin/rubik-types/${id}`,
        {
          headers: {
            Authorization: token
          }
        }
      );

      if (response.data.status && response.data.data?.rubikType) {
        this.rubikType = response.data.data.rubikType;
        //alert(JSON.stringify(this.rubikType));
        this.lastFetchedAt = new Date();
        this.detailError = null;
      } else {
        const message = response.data.message || 'Rubik type not found';
        this.detailError = message;
        this.rubikType = null;
      }
    } catch (error: any) {
      console.error('Failed to load rubik type detail', error);
      if (error?.response?.status === 401) {
        this.handleUnauthorized();
        return;
      }
      this.detailError = error?.response?.data?.message || error?.message || 'Failed to fetch rubik type';
      this.rubikType = null;
    } finally {
      this.isDetailLoading = false;
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

  applyFilters(): void {
    this.currentPage = 1;
    this.loadRubikTypes();
  }

  resetFilters(): void {
    this.filters = {
      searchTerm: '',
      sortBy: 'newest'
    };
    this.currentPage = 1;
    this.loadRubikTypes();
  }

  refreshTable(): void {
    this.loadRubikTypes();
  }

  refreshCurrent(): void {
    if (this.currentRubikTypeId !== null) {
      this.fetchRubikTypeDetail(this.currentRubikTypeId);
    }
  }

  inspectRubikType(rubikType: RubikTypeDetail): void {
    const identifier = this.getRubikTypeIdentifier(rubikType);
    if (!identifier) {
      this.currentRubikTypeId = null;
      this.rubikType = rubikType;
      this.lastFetchedAt = new Date();
      this.detailError = null;
      this.isDetailDrawerOpen = true;
      return;
    }

    this.router.navigate(['/admin/rubik-types', identifier]);
  }

  closeDetailDrawer(navigateBack = true): void {
    this.isDetailDrawerOpen = false;
    this.rubikType = null;
    this.detailError = null;
    this.activeTab = 'overview';
    this.lastFetchedAt = null;

    if (navigateBack) {
      this.router.navigate(['/admin/rubik-types']);
    }
  }

  setActiveTab(tab: RubikTypeTab): void {
    this.activeTab = tab;
  }

  openEditModal(rubikType: RubikTypeDetail): void {
    this.modalError = null;
    this.isModalOpen = true;
    this.editingRubikTypeId = this.getRubikTypeIdentifier(rubikType);
    this.rubikTypeForm = {
      type_name: rubikType.type_name || '',
      description: rubikType.description || '',
      variation: this.normalizeVariationInput(rubikType.variation)
    };
  }

  navigateToCreate(): void {
    this.router.navigate(['/admin/rubik-types/create']);
  }

  closeModal(): void {
    if (this.isModalSubmitting) {
      return;
    }
    this.isModalOpen = false;
    this.modalError = null;
    this.editingRubikTypeId = null;
  }

  async submitRubikTypeForm(form?: NgForm): Promise<void> {
    this.modalError = null;

    if (!this.rubikTypeForm.type_name.trim()) {
      this.modalError = 'Type name is required.';
      form?.form.markAllAsTouched();
      return;
    }

    const variationValue = this.normalizeVariationInput(this.rubikTypeForm.variation);
    if (variationValue === null) {
      this.modalError = 'Variation is required and must be zero or greater.';
      form?.form.markAllAsTouched();
      return;
    }

    const token = this.getAuthorizationToken();
    if (!token) {
      return;
    }

    this.isModalSubmitting = true;

    try {
      const payload = {
        type_name: this.rubikTypeForm.type_name.trim(),
        description: this.rubikTypeForm.description.trim(),
        variation: variationValue
      };

      const editedIdentifier = this.editingRubikTypeId;

      if (editedIdentifier === null) {
        this.modalError = 'Unable to determine which rubik type to update.';
        return;
      }

      await this.updateRubikType(payload, token, editedIdentifier);

      this.closeModal();
      await this.loadRubikTypes();
      if (
        this.currentRubikTypeId !== null &&
        editedIdentifier !== null &&
        this.getSafeIdentifier(editedIdentifier) === this.getSafeIdentifier(this.currentRubikTypeId)
      ) {
        this.fetchRubikTypeDetail(this.currentRubikTypeId);
      }
    } catch (error: any) {
      console.error('Rubik type mutation failed', error);
      if (error?.response?.status === 401) {
        this.handleUnauthorized();
        return;
      }
      this.modalError =
        error?.response?.data?.message || error?.message || 'Unable to save rubik type. Please try again.';
    } finally {
      this.isModalSubmitting = false;
    }
  }

  get attributeEntries(): Array<{ key: string; value: unknown }> {
    if (!this.rubikType) {
      return [];
    }

    const excludedKeys = new Set([
      '_id',
      'id',
      'type_name',
      'description',
      'variation',
      'products',
      'variants',
      'created_at',
      'updated_at',
      'created_date',
      'updated_date'
    ]);

    return Object.entries(this.rubikType)
      .filter(([key]) => !excludedKeys.has(key))
      .map(([key, value]) => ({ key, value }));
  }

  get linkedProducts(): RubikTypeLinkedProduct[] {
    if (!this.rubikType?.products || !Array.isArray(this.rubikType.products)) {
      return [];
    }
    return this.rubikType.products;
  }

  get variantList(): RubikTypeVariant[] {
    if (!this.rubikType?.variants || !Array.isArray(this.rubikType.variants)) {
      return [];
    }
    return this.rubikType.variants;
  }

  get hasLinkedProducts(): boolean {
    return this.linkedProducts.length > 0;
  }

  get hasVariants(): boolean {
    return this.variantList.length > 0;
  }

  formatAttributeValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '—';
    }

    if (Array.isArray(value)) {
      return value.length ? JSON.stringify(value) : '[]';
    }

    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return '[object]';
      }
    }

    return String(value);
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

  formatDateTime(value?: string): string {
    if (!value) {
      return 'Unknown';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Unknown';
    }
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  truncateText(value: string | null | undefined, limit = 140): string {
    if (!value) {
      return '—';
    }
    const trimmed = value.trim();
    if (trimmed.length <= limit) {
      return trimmed;
    }
    return `${trimmed.slice(0, limit).trim()}…`;
  }

  getVariantCount(type: RubikTypeDetail): number {
    const variationValue = this.normalizeVariationInput(type.variation);
    if (variationValue !== null) {
      return variationValue;
    }
    if (!type.variants || !Array.isArray(type.variants)) {
      return 0;
    }
    return type.variants.length;
  }

  getPageNumbers(): number[] {
    if (!this.pagination) {
      return [];
    }

    const totalPages = this.pagination.totalPages;
    const current = this.pagination.currentPage;
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

  getRowNumber(index: number): number {
    return (this.currentPage - 1) * this.pageSize + index + 1;
  }

  trackByRubikType(_index: number, rubikType: RubikTypeDetail): RubikTypeIdentifier | string {
    return this.getRubikTypeIdentifier(rubikType) ?? `${rubikType.type_name}-${_index}`;
  }

  setFallbackImage(event: Event): void {
    const target = event.target as HTMLImageElement | null;
    if (target) {
      target.src = 'https://gw.alipayobjects.com/zos/rmsportal/BiazfanxmamNRoxxVxka.png';
    }
  }

  private async updateRubikType(payload: RubikTypeFormModel, token: string, id: RubikTypeIdentifier): Promise<void> {
    const response = await axios.put<RubikTypeMutationResponse>(
      `${environment.server_url}/admin/rubik-types/${id}`,
      payload,
      {
        headers: {
          Authorization: token
        }
      }
    );

    if (response.data.status) {
      this.popupService.AlertSuccessDialog(response.data.message || 'Rubik type updated successfully', 'Success');
    } else {
      throw new Error(response.data.message || 'Failed to update rubik type');
    }
  }

  private normalizeVariationInput(value: number | string | null | undefined): number | null {
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

  private applyClientFilters(rubikTypes: RubikTypeDetail[]): RubikTypeDetail[] {
    return rubikTypes.filter(rubikType => {
      if (this.filters.searchTerm.trim()) {
        const term = this.filters.searchTerm.trim().toLowerCase();
        const haystack = `${rubikType.type_name || ''} ${rubikType.description || ''}`.toLowerCase();
        return haystack.includes(term);
      }

      return true;
    });
  }

  private normalizePagination(payload: RubikTypePaginationPayload | undefined, fallbackTotal: number): RubikTypePagination {
    const currentPage =
      payload?.currentPage ??
      payload?.page ??
      payload?.pageIndex ??
      this.currentPage;
    const limit = payload?.limit ?? payload?.perPage ?? this.pageSize;
    const totalItems =
      payload?.totalRubikTypes ??
      payload?.totalItems ??
      payload?.total ??
      fallbackTotal;
    const totalPages = payload?.totalPages ?? payload?.pages ?? Math.max(1, Math.ceil(totalItems / limit || 1));

    return {
      currentPage,
      totalPages,
      totalItems,
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

  private getRubikTypeIdentifier(rubikType: RubikTypeDetail): RubikTypeIdentifier | null {
    if (rubikType._id !== undefined && rubikType._id !== null) {
      return rubikType._id;
    }
    if (rubikType.id !== undefined && rubikType.id !== null) {
      return rubikType.id;
    }
    return null;
  }

  private parseIdentifier(value: string): RubikTypeIdentifier | null {
    if (/^\d+$/.test(value)) {
      return Number(value);
    }
    return value || null;
  }

  private getSafeIdentifier(value: RubikTypeIdentifier): string {
    return String(value);
  }

  private closeColumnDropdown(): void {
    this.isColumnDropdownOpen = false;
  }

  private updateSelectedColumns(): void {
    this.selectedColumns = this.columns.filter(column => this.columnVisibility[column.value]).map(column => column.value);
  }

  private normalizeListPayload(
    payload: RubikTypeListResponse | RubikTypeDetail[] | unknown
  ): { items: RubikTypeDetail[]; pagination?: RubikTypePaginationPayload; totalFallback: number } | null {
    if (Array.isArray(payload)) {
      return {
        items: payload,
        pagination: undefined,
        totalFallback: payload.length
      };
    }

    if (payload && typeof payload === 'object') {
      const typedPayload = payload as RubikTypeListResponse & {
        rubikTypes?: RubikTypeDetail[];
        data?: RubikTypeDetail[] | { rubikTypes?: RubikTypeDetail[]; pagination?: RubikTypePaginationPayload };
        pagination?: RubikTypePaginationPayload;
      };

      if (Object.prototype.hasOwnProperty.call(typedPayload, 'status')) {
        if (typedPayload.status) {
          const items = typedPayload.data?.rubikTypes ?? [];
          return {
            items,
            pagination: typedPayload.data?.pagination,
            totalFallback: items.length
          };
        }

        this.listError = typedPayload.message || 'Failed to load rubik types';
        return null;
      }

      if (typedPayload.data && !Array.isArray(typedPayload.data)) {
        const nested = typedPayload.data;
        const items = nested.rubikTypes ?? [];

        if (Array.isArray(items)) {
          return {
            items,
            pagination: nested.pagination ?? typedPayload.pagination,
            totalFallback: items.length
          };
        }
      }

      const directList =
        (typedPayload.data && Array.isArray(typedPayload.data) ? typedPayload.data : undefined) ??
        typedPayload.rubikTypes ??
        [];

      if (Array.isArray(directList)) {
        return {
          items: directList,
          pagination: typedPayload.pagination,
          totalFallback: directList.length
        };
      }
    }

    return null;
  }
}

