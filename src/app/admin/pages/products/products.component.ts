import { Component, ElementRef, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PopupService } from '../../../../services/popup.service';
import Swal from 'sweetalert2';
import axios from 'axios';
import { environment } from '../../../../environments/environment';
import { IRubik } from '../../../models/item.model';

interface PaginationData {
  currentPage: number;
  totalPages: number;
  totalProducts: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface ProductsResponse {
  status: boolean;
  message: string;
  data: {
    products: Product[];
    pagination: PaginationData;
  };
}

interface DeleteProductResponse {
  status: boolean;
  message: string;
}

interface CategorySummary {
  _id: string;
  category_name: string;
  id?: string;
}

interface CategoriesListResponse {
  status: boolean;
  message: string;
  data?: {
    categories?: Array<{
      _id?: string;
      id?: string | number;
      category_name?: string;
    }>;
  };
}

// Extended product interface to handle MongoDB _id
interface Product extends IRubik {
  _id?: string;
  category_name?: string;
  category?: {
    category_name?: string;
  } | null;
}

type ColumnKey =
  | 'id'
  | 'name'
  | 'category'
  | 'description'
  | 'avatar'
  | 'features'
  | 'actions';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './products.component.html',
  styleUrl: './products.component.scss'
})
export class ProductsComponent implements OnInit {
  products: Product[] = [];
  pagination: PaginationData | null = null;
  isLoading = false;
  error: string | null = null;
  isLoadingCategories = false;
  categoriesError: string | null = null;

  // Search and filters
  searchTerm = '';

  // Pagination
  currentPage = 1;
  pageSize = 10;
  pageSizeOptions = [10, 20, 50, 100];

  columns: Array<{ label: string; value: ColumnKey }> = [
    { label: 'ID', value: 'id' },
    { label: 'Name', value: 'name' },
    { label: 'Category', value: 'category' },
    { label: 'Description', value: 'description' },
    { label: 'Image', value: 'avatar' },
    { label: 'Features', value: 'features' },
    { label: 'Actions', value: 'actions' }
  ];

  // Column visibility
  columnVisibility: Record<ColumnKey, boolean> = {
    id: true,
    name: true,
    category: true,
    description: true,
    avatar: true,
    features: false,
    actions: true
  };

  selectedColumns: ColumnKey[] = ['id', 'name', 'category', 'description', 'avatar', 'actions'];
  isColumnDropdownOpen = false;
  categories: CategorySummary[] = [];
  categoryLookup: Record<string, string> = {};

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
    this.loadCategoriesForLookup();
    this.loadProducts();
  }

  async loadProducts(): Promise<void> {
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
      const response = await axios.get<ProductsResponse>(
        `${environment.server_url}/admin/products?${params.toString()}`,
        { headers: { 'Authorization': authHeader } }
      );

      if (response.data.status && response.data.data) {
        this.products = response.data.data.products;
        this.pagination = response.data.data.pagination;
      } else {
        this.error = response.data.message || 'Failed to load products';
        this.products = [];
        this.pagination = null;
      }
    } catch (error: any) {
      console.error('Error loading products:', error);
      if (error.response?.status === 401) {
        this.popupService.AlertErrorDialog('Unauthorized access', 'Error');
        localStorage.removeItem('TOKEN');
        window.location.href = '/admin/login';
      } else {
        this.error = error.response?.data?.message || 'Failed to load products';
        this.popupService.AlertErrorDialog(this.error ?? 'Failed to load products', 'Error');
      }
      this.products = [];
      this.pagination = null;
    } finally {
      this.isLoading = false;
    }
  }

  onSearch(): void {
    this.currentPage = 1; // Reset to first page on new search
    this.loadProducts();
  }

  onPageSizeChange(): void {
    this.currentPage = 1; // Reset to first page on page size change
    this.loadProducts();
  }

  goToPage(page: number): void {
    if (page >= 1 && this.pagination && page <= this.pagination.totalPages) {
      this.currentPage = page;
      this.loadProducts();
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

  truncateText(text: string, maxLength: number = 100): string {
    if (!text) return '-';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  async deleteProduct(product: Product): Promise<void> {
    const result = await Swal.fire({
      title: 'Confirm Delete',
      text: `Are you sure you want to delete product "${product.name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    });

    if (!result.isConfirmed) return;

    try {
      const token = localStorage.getItem('TOKEN');
      const productId = product._id || product.id;
      if (!productId) {
        this.popupService.AlertErrorDialog('Product ID not found', 'Error');
        return;
      }

      const authHeader: string = token ? token : '';
      const response = await axios.get<DeleteProductResponse>(
        `${environment.server_url}/admin/products/${productId}/delete`,
        { headers: { Authorization: authHeader } }
      );

      if (response.data.status) {
        this.popupService.AlertSuccessDialog(
          response.data.message || 'Product deleted successfully',
          'Success'
        );
        await this.loadProducts();
      } else {
        const message = response.data.message || 'Failed to delete product';
        this.popupService.AlertErrorDialog(message, 'Error');
      }
    } catch (error: any) {
      console.error('Error deleting product:', error);
      if (error.response?.status === 401) {
        this.popupService.AlertErrorDialog('Unauthorized access', 'Error');
        localStorage.removeItem('TOKEN');
        window.location.href = '/admin/login';
      } else {
        this.popupService.AlertErrorDialog(
          error.response?.data?.message || 'Failed to delete product',
          'Error'
        );
      }
    }
  }

  refreshProducts(): void {
    this.loadProducts();
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

  addProduct(): void {
    this.router.navigate(['/admin/products/create']);
  }

  editProduct(product: Product): void {
    const productId = product._id || product.id;
    if (!productId) return;
    this.router.navigate(['/admin/products', productId, 'edit']);
  }

  getProductId(product: Product): string {
    return product._id || product.id?.toString() || '-';
  }

  getCategoryLabel(product: Product): string {
    const directName = this.getInlineCategoryName(product);
    if (directName) {
      return directName;
    }

    const categoryId = this.normalizeId(product.category_id);
    if (categoryId && this.categoryLookup[categoryId]) {
      return this.categoryLookup[categoryId];
    }

    if (categoryId) {
      return this.isLoadingCategories ? 'Loading category...' : 'Unknown category';
    }

    return 'No category';
  }

  private async loadCategoriesForLookup(): Promise<void> {
    this.isLoadingCategories = true;
    this.categoriesError = null;

    try {
      const token = localStorage.getItem('TOKEN') ?? '';
      const params = new URLSearchParams();
      params.append('page', '1');
      params.append('limit', '1000');

      const response = await axios.get<CategoriesListResponse>(
        `${environment.server_url}/admin/categories?${params.toString()}`,
        { headers: { Authorization: token } }
      );

      if (response.data.status && response.data.data?.categories) {
        const mappedCategories = response.data.data.categories
          .map(category => {
            const normalizedName = this.normalizeCategoryName(category.category_name);
            const normalizedObjectId = this.normalizeId(category._id);
            if (!normalizedName || !normalizedObjectId) {
              return null;
            }

            const normalizedNumericId = this.normalizeId(category.id);

            const summary: CategorySummary = {
              _id: normalizedObjectId,
              category_name: normalizedName
            };

            if (normalizedNumericId) {
              summary.id = normalizedNumericId;
            }

            return summary;
          })
          .filter((category): category is CategorySummary => category !== null);

        this.categories = mappedCategories;

        this.categoryLookup = mappedCategories.reduce((acc, category) => {
          acc[category._id] = category.category_name;
          if (category.id) {
            acc[category.id] = category.category_name;
          }
          return acc;
        }, {} as Record<string, string>);
      } else {
        this.categoriesError =
          response.data.message || 'Failed to load categories';
        this.categories = [];
        this.categoryLookup = {};
      }
    } catch (error: any) {
      console.error('Error loading categories for lookup:', error);
      if (error.response?.status === 401) {
        // loadProducts will handle redirect/logout
        this.categoriesError = 'Unauthorized access';
      } else {
        this.categoriesError =
          error.response?.data?.message || 'Failed to load categories';
      }
      this.categories = [];
      this.categoryLookup = {};
    } finally {
      this.isLoadingCategories = false;
    }
  }

  private getInlineCategoryName(product: Product): string | null {
    const direct = this.normalizeCategoryName(product.category_name);
    if (direct) {
      return direct;
    }

    const nestedCategoryName = this.normalizeCategoryName(product.category?.category_name);
    return nestedCategoryName;
  }

  private normalizeCategoryName(raw?: string | null): string | null {
    if (!raw) {
      return null;
    }
    const trimmed = raw.trim();
    return trimmed ? trimmed : null;
  }

  private normalizeId(value?: string | number | null): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    const normalized = value.toString().trim();
    return normalized || null;
  }
}

