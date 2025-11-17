import { Component, ElementRef, HostListener, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PopupService } from '../../../../services/popup.service';
import Swal from 'sweetalert2';
import axios from 'axios';
import { environment } from '../../../../environments/environment';
import { AdminUser } from '../../models/admin-user.model';

interface PaginationData {
  currentPage: number;
  totalPages: number;
  totalUsers: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface UsersResponse {
  status: boolean;
  message: string;
  data: {
    users: AdminUser[];
    pagination: PaginationData;
  };
}

interface DeleteUserResponse {
  status: boolean;
  message: string;
}

type ColumnKey = 'id' | 'user' | 'email' | 'role' | 'gender' | 'joinedDate';

interface CreateUserResponse {
  status: boolean;
  message: string;
  data?: {
    user?: AdminUser;
  };
}

interface CreateUserPayload {
  username: string;
  password: string;
  email: string;
  phone: string;
  gender: string;
  avatar?: string;
  role_id: string | number;
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss'
})
export class UsersComponent implements OnInit {
  users: AdminUser[] = [];
  pagination: PaginationData | null = null;
  isLoading = false;
  error: string | null = null;

  
  // Search and filters
  searchTerm = '';
  selectedRole = '';
  availableRoles: string[] = [];
  
  // Initialize with all possible roles from roleOptions (including disabled ones for filtering)
  getAllRoleLabels(): string[] {
    return this.roleOptions.map(role => role.label);
  }
  
  // Pagination
  currentPage = 1;
  pageSize = 10;
  pageSizeOptions = [10, 20, 50, 100];

  columns: Array<{ label: string; value: ColumnKey }> = [
    { label: 'ID', value: 'id' },
    { label: 'User', value: 'user' },
    { label: 'Email', value: 'email' },
    { label: 'Role', value: 'role' },
    { label: 'Gender', value: 'gender' },
    { label: 'Joined Date', value: 'joinedDate' }
  ];


  // Column visibility
  columnVisibility: Record<ColumnKey, boolean> & { actions: boolean } = {
    id: true,
    user: true,
    email: true,
    role: true,
    gender: true,
    joinedDate: true,
    actions: true
  };

  selectedColumns: ColumnKey[] = ['id', 'user', 'email', 'role', 'gender', 'joinedDate'];
  isColumnDropdownOpen = false;

  addUserForm: FormGroup;
  isAddUserModalOpen = false;
  isCreatingUser = false;
  createUserError = '';
  createUserMessage = '';
  roleOptions = [
    { label: 'User', roleId: '0', disabled: false },
    { label: 'Admin', roleId: '1', disabled: true },
  ];
  genderOptions = ['Male', 'Female', 'Other', 'Prefer not to say'];

  constructor(
    private popupService: PopupService,
    private elementRef: ElementRef,
    private router: Router,
    private fb: FormBuilder
  ) {
    this.addUserForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.minLength(8)]],
      gender: ['', Validators.required],
      avatar: [''],
      role_id: ['', Validators.required]
    });
  }

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
    // Initialize available roles with all possible roles
    this.availableRoles = this.getAllRoleLabels();
    this.loadUsers();
  }

  async loadUsers(): Promise<void> {
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
      
      if (this.selectedRole) {
        params.append('role', this.selectedRole);
      }

      const authHeader: string = token ? token : '';
      const response = await axios.get<UsersResponse>(
        `${environment.server_url}/admin/users?${params.toString()}`,
        { headers: { 'Authorization': authHeader } }
      );

      if (response.data.status && response.data.data) {
        this.users = response.data.data.users;
        this.pagination = response.data.data.pagination;
        
        // Get all possible roles from roleOptions
        const allPossibleRoles = new Set<string>(this.getAllRoleLabels());
        
        // Also include any unique roles found in the user data (for custom roles)
        this.users.forEach(user => {
          if (user.role) {
            allPossibleRoles.add(user.role);
          }
        });
        
        // Sort roles: standard roles first, then any custom roles
        const standardRoles = this.getAllRoleLabels();
        const customRoles = Array.from(allPossibleRoles).filter(role => !standardRoles.includes(role));
        this.availableRoles = [...standardRoles.sort(), ...customRoles.sort()];
      } else {
        this.error = response.data.message || 'Failed to load users';
        this.users = [];
        this.pagination = null;
      }
    } catch (error: any) {
      console.error('Error loading users:', error);
      if (error.response?.status === 401) {
        this.popupService.AlertErrorDialog('Unauthorized access', 'Error');
        localStorage.removeItem('TOKEN');
        window.location.href = '/admin/login';
      } else {
        this.error = error.response?.data?.message || 'Failed to load users';
        this.popupService.AlertErrorDialog(this.error ?? 'Failed to load users', 'Error');
      }
      this.users = [];
      this.pagination = null;
    } finally {
      this.isLoading = false;
    }
  }

  onSearch(): void {
    this.currentPage = 1; // Reset to first page on new search
    this.loadUsers();
  }

  onRoleFilterChange(): void {
    this.currentPage = 1; // Reset to first page on filter change
    this.loadUsers();
  }

  onPageSizeChange(): void {
    this.currentPage = 1; // Reset to first page on page size change
    this.loadUsers();
  }

  goToPage(page: number): void {
    if (page >= 1 && this.pagination && page <= this.pagination.totalPages) {
      this.currentPage = page;
      this.loadUsers();
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

  getRoleBadgeClass(role: string): string {
    const roleLower = role?.toLowerCase() || '';
    if (roleLower.includes('admin')) return 'badge-admin';
    // if (roleLower.includes('premium')) return 'badge-premium';
    // if (roleLower.includes('guest')) return 'badge-guest';
    return 'badge-user';
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

  async deleteUser(user: AdminUser): Promise<void> {
    const result = await Swal.fire({
      title: 'Confirm Delete',
      text: `Are you sure you want to delete user "${user.username}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    });

    if (!result.isConfirmed) return;

    try {
      const token = localStorage.getItem('TOKEN');
      const authHeader: string = token ? token : '';
      const response = await axios.get<DeleteUserResponse>(
        `${environment.server_url}/admin/users/${user._id}/delete`,
        { headers: { 'Authorization': authHeader } }
      );

      if (response.data.status) {
        this.popupService.AlertSuccessDialog(
          response.data.message || 'User deleted successfully',
          'Success'
        );
        await this.loadUsers();
      } else {
        const message = response.data.message || 'Failed to delete user';
        this.popupService.AlertErrorDialog(message, 'Error');
      }
    } catch (error: any) {
      console.error('Error deleting user:', error);
      if (error.response?.status === 401) {
        this.popupService.AlertErrorDialog('Unauthorized access', 'Error');
        localStorage.removeItem('TOKEN');
        window.location.href = '/admin/login';
      } else {
        this.popupService.AlertErrorDialog(
          error.response?.data?.message || 'Failed to delete user',
          'Error'
        );
      }
    }
  }

  refreshUsers(): void {
    this.loadUsers();
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

  addUser(): void {
    this.router.navigate(['/admin/users/create']);
  }

  openAddUserModal(): void {
    if (this.isCreatingUser) {
      return;
    }
    this.addUserForm.reset({
      username: '',
      password: '',
      email: '',
      phone: '',
      gender: '',
      avatar: '',
      role_id: ''
    });
    this.createUserError = '';
    this.createUserMessage = '';
    this.isAddUserModalOpen = true;
  }

  closeAddUserModal(): void {
    if (this.isCreatingUser) {
      return;
    }
    this.isAddUserModalOpen = false;
    this.createUserError = '';
  }

  controlInvalid(controlName: string): boolean {
    const control = this.addUserForm.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  controlErrorMessage(controlName: string): string {
    const control = this.addUserForm.get(controlName);
    if (!control || !control.errors) {
      return '';
    }
    if (control.errors['required']) {
      return 'This field is required';
    }
    if (control.errors['email']) {
      return 'Enter a valid email';
    }
    if (control.errors['minlength']) {
      const requiredLength = control.errors['minlength']?.requiredLength;
      return `Minimum ${requiredLength} characters`;
    }
    return 'Invalid value';
  }

  async submitNewUser(): Promise<void> {
    if (this.addUserForm.invalid) {
      this.addUserForm.markAllAsTouched();
      return;
    }

    const payload = this.buildCreateUserPayload();
    const token = localStorage.getItem('TOKEN') ?? '';

    try {
      this.isCreatingUser = true;
      this.createUserError = '';
      const response = await axios.post<CreateUserResponse>(
        `${environment.server_url}/admin/users`,
        payload,
        { headers: { Authorization: token } }
      );

      if (!response.data?.status) {
        const message = response.data?.message || 'Failed to create user';
        this.createUserError = message;
        this.popupService.AlertErrorDialog(message, 'Create user failed');
        return;
      }

      const successMessage = response.data?.message || 'User created successfully';
      this.createUserMessage = successMessage;
      this.popupService.AlertSuccessDialog(successMessage, 'Success');
      this.isAddUserModalOpen = false;
      this.addUserForm.reset();
      await this.loadUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      if (error.response?.status === 401) {
        this.popupService.AlertErrorDialog('Session expired. Please log in again.', 'Unauthorized');
        localStorage.removeItem('TOKEN');
        window.location.href = '/admin/login';
        return;
      }
      const message =
        error.response?.data?.message ||
        (error.response?.status === 409
          ? 'User with this username, email, or phone already exists'
          : 'Failed to create user');
      this.createUserError = message;
      this.popupService.AlertErrorDialog(message, 'Create user failed');
    } finally {
      this.isCreatingUser = false;
    }
  }

  private buildCreateUserPayload(): CreateUserPayload {
    const value = this.addUserForm.value;
    const username = (value['username'] ?? '').toString().trim();
    const password = (value['password'] ?? '').toString();
    const email = (value['email'] ?? '').toString().trim().toLowerCase();
    const phone = (value['phone'] ?? '').toString().replace(/\s+/g, '');
    const gender = (value['gender'] ?? '').toString().trim();
    const avatarRaw = (value['avatar'] ?? '').toString().trim();

    return {
      username,
      password,
      email,
      phone,
      gender,
      avatar: avatarRaw || undefined,
      role_id: this.normalizeRoleId(value['role_id'])
    };
  }

  private normalizeRoleId(roleId: string | number): string | number {
    if (roleId === null || roleId === undefined) {
      return '';
    }
    if (typeof roleId === 'number') {
      return roleId;
    }
    const trimmed = roleId.toString().trim();
    if (!trimmed) {
      return '';
    }
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? trimmed : parsed;
  }

  editUser(user: AdminUser): void {
    if (!user?._id) return;
    this.router.navigate(['/admin/users', user._id, 'edit']);
  }
}
