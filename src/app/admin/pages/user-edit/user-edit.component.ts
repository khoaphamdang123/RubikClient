import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import axios from 'axios';
import Swal from 'sweetalert2';
import { environment } from '../../../../environments/environment';
import { PopupService } from '../../../../services/popup.service';
import { AdminUser } from '../../models/admin-user.model';

interface UserDetailResponse {
  status: boolean;
  message: string;
  data: {
    user: AdminUser;
  };
}

interface UpdateUserResponse {
  status: boolean;
  message: string;
  data?: {
    user?: AdminUser;
  };
}

@Component({
  selector: 'app-user-edit',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './user-edit.component.html',
  styleUrl: './user-edit.component.scss'
})
export class UserEditComponent implements OnInit {
  userForm: FormGroup;
  isLoading = true;
  isSaving = false;
  isDeleting = false;
  loadError: string | null = null;
  userId = '';
  userData?: AdminUser;
  initialFormValue: any;
  serverMessage = '';
  lastSyncedAt: Date | null = null;
  avatarFileName = '';
  avatarUploadError = '';
  isAvatarDropActive = false;
  readonly maxAvatarSizeMb = 3;
  readonly maxAvatarSizeBytes = this.maxAvatarSizeMb * 1024 * 1024;
  private avatarDragDepth = 0;

  readonly fallbackAvatar =
    'https://gw.alipayobjects.com/zos/rmsportal/BiazfanxmamNRoxxVxka.png';

  roleOptions = [
    { label: 'User', roleId: '0' },
    { label: 'Admin', roleId: '1' },
    { label: 'Premium', roleId: '2' },
    { label: 'Guest', roleId: '3' }
  ];

  genderOptions = ['Male', 'Female', 'Other', 'Prefer not to say'];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private popupService: PopupService
  ) {
    this.userForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      gender: [''],
      avatar: [''],
      role: ['', Validators.required],
      role_id: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.userId = this.route.snapshot.paramMap.get('id') || '';

    if (!this.userId) {
      this.loadError = 'Missing user identifier. Please return to the user list.';
      this.isLoading = false;
      return;
    }

    this.fetchUser();
  }

  get avatarPreview(): string {
    const raw = this.userForm.get('avatar')?.value?.trim();
    return raw || this.fallbackAvatar;
  }

  get joinedDateLabel(): string {
    if (!this.userData?.created_date) {
      return 'Not available';
    }
    try {
      return new Date(this.userData.created_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return this.userData.created_date;
    }
  }

  get disableSave(): boolean {
    return this.isSaving || this.userForm.invalid || !this.userForm.dirty;
  }

  get disableReset(): boolean {
    return this.isSaving || !this.userForm.dirty;
  }

  async fetchUser(): Promise<void> {
    try {
      this.isLoading = true;
      this.loadError = null;
      this.serverMessage = '';
      this.avatarUploadError = '';
      this.avatarFileName = '';
      this.isAvatarDropActive = false;
      this.avatarDragDepth = 0;

      const token = localStorage.getItem('TOKEN');
      const response = await axios.get<UserDetailResponse>(
        `${environment.server_url}/admin/users/${this.userId}/edit`,
        { headers: { Authorization: token } }
      );

      const user = response.data?.data?.user;

      if (!user) {
        throw new Error(response.data?.message || 'User not found');
      }
      this.serverMessage = response.data?.message || 'User detail retrieved.';
      this.lastSyncedAt = new Date();
      this.userData = user;
      this.ensureRoleOption(user);
      this.userForm.patchValue({
        username: user.username || '',
        email: user.email || '',
        gender: user.gender || '',
        avatar: user.avatar || '',
        role: user.role || '',
        role_id: user.role_id?.toString() ?? ''
      });
      this.userForm.markAsPristine();
      this.initialFormValue = this.userForm.getRawValue();
    } catch (error: any) {
      console.error('Error loading user:', error);
      const status = error.response?.status;
      if (status === 401) {
        localStorage.removeItem('TOKEN');
        this.popupService.AlertErrorDialog('Session expired. Please log in again.', 'Unauthorized');
        this.router.navigate(['/admin/login']);
        return;
      }
      if (status === 403) {
        this.loadError =
          error.response?.data?.message ||
          'You do not have permission to edit this user.';
        return;
      }
      if (status === 404) {
        this.loadError = 'User not found or already removed.';
        return;      
      }
      this.loadError = error.response?.data?.message || error.message || 'Failed to load user details';
    } finally {
      this.isLoading = false;
    }
  }

  async saveChanges(): Promise<void> {
    if (this.userForm.invalid || !this.userId) {
      this.userForm.markAllAsTouched();
      return;
    }

    try {
      this.isSaving = true;
      const token = localStorage.getItem('TOKEN') ?? '';
      const payload = this.buildPayload();

      const response = await axios.post<UpdateUserResponse>(
        `${environment.server_url}/admin/users/${this.userId}`,
        payload,
        { headers: { Authorization: token } }
      );

      if (!response.data?.status) {
        const message = response.data?.message || 'Failed to update user';
        this.popupService.AlertErrorDialog(message, 'Update failed');
        return;
      }

      const successMessage = response.data?.message || 'User updated successfully';
      const updatedUser = response.data?.data?.user;

      if (updatedUser) {
        this.userData = updatedUser;
        this.ensureRoleOption(updatedUser);
        this.userForm.patchValue({
          username: updatedUser.username || '',
          email: updatedUser.email || '',
          gender: updatedUser.gender || '',
          avatar: updatedUser.avatar || '',
          role: updatedUser.role || '',
          role_id: updatedUser.role_id?.toString() ?? ''
        });
        this.userForm.markAsPristine();
        this.initialFormValue = this.userForm.getRawValue();
        this.lastSyncedAt = new Date();
      } else {
        await this.fetchUser();
      }

      this.serverMessage = successMessage;
      this.popupService.AlertSuccessDialog(successMessage, 'Success');
    } catch (error: any) {
      console.error('Error updating user:', error);
      if (error.response?.status === 401) {
        this.popupService.AlertErrorDialog('Session expired. Please log in again.', 'Unauthorized');
        localStorage.removeItem('TOKEN');
        this.router.navigate(['/admin/login']);
        return;
      }
      if (error.response?.status === 403) {
        this.popupService.AlertErrorDialog(
          error.response?.data?.message || 'Updating this user is not allowed',
          'Forbidden'
        );
        return;
      }
      this.popupService.AlertErrorDialog(
        error.response?.data?.message || 'Failed to update user',
        'Error'
      );
    } finally {
      this.isSaving = false;
    }
  }

  async deleteUser(): Promise<void> {
    if (!this.userData?._id || this.isDeleting) {
      return;
    }
    
    const result = await Swal.fire({
      title: 'Delete user?',
      text: `This will permanently remove ${this.userData.username}.`,
      icon: 'warning',
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      showCancelButton: true,
      confirmButtonColor: '#dc2626'
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      this.isDeleting = true;
      const token = localStorage.getItem('TOKEN');
      await axios.delete(`${environment.server_url}/admin/users/${this.userData._id}`, {
        headers: { Authorization: token }
      });
      this.popupService.AlertSuccessDialog('User deleted successfully', 'Deleted');
      this.router.navigate(['/admin/users']);
    } catch (error: any) {
      console.error('Error deleting user:', error);
      if (error.response?.status === 401) {
        this.popupService.AlertErrorDialog('Session expired. Please log in again.', 'Unauthorized');
        localStorage.removeItem('TOKEN');
        this.router.navigate(['/admin/login']);
        return;
      }
      this.popupService.AlertErrorDialog(
        error.response?.data?.message || 'Failed to delete user',
        'Error'
      );
    } finally {
      this.isDeleting = false;
    }
  }

  refresh(): void {
    if (!this.isLoading) {
      this.fetchUser();
    }
  }

  resetChanges(): void {
    if (!this.initialFormValue) {
      return;
    }
    this.userForm.reset(this.initialFormValue);
    this.userForm.markAsPristine();
    this.avatarFileName = '';
    this.avatarUploadError = '';
    this.isAvatarDropActive = false;
    this.avatarDragDepth = 0;
  }

  goBack(): void {
    this.router.navigate(['/admin/users']);
  }

  controlInvalid(controlName: string): boolean {
    const control = this.userForm.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  onRoleIdChange(event: Event): void {
    const roleId = (event.target as HTMLSelectElement)?.value ?? '';
    const match = this.roleOptions.find(option => option.roleId === roleId);
    if (match) {
      this.userForm.patchValue({ role: match.label }, { emitEvent: false });
    }
  }

  onAvatarError(event: Event): void {
    (event.target as HTMLImageElement).src = this.fallbackAvatar;
  }

  onAvatarFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.processAvatarFile(file, () => {
      input.value = '';
    });
  }

  onAvatarDragEnter(event: DragEvent): void {
    event.preventDefault();
    this.isAvatarDropActive = true;
    this.avatarDragDepth += 1;
  }

  onAvatarDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onAvatarDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.avatarDragDepth = Math.max(0, this.avatarDragDepth - 1);
    if (this.avatarDragDepth === 0) {
      this.isAvatarDropActive = false;
    }
  }

  onAvatarDrop(event: DragEvent): void {
    event.preventDefault();
    this.isAvatarDropActive = false;
    this.avatarDragDepth = 0;
    const file = event.dataTransfer?.files?.[0];
    this.processAvatarFile(file);
  }

  clearAvatarSelection(): void {
    const avatarControl = this.userForm.get('avatar');
    const fallback = this.initialFormValue?.avatar ?? '';
    avatarControl?.setValue(fallback);
    avatarControl?.markAsPristine();
    avatarControl?.markAsUntouched();
    this.avatarFileName = '';
    this.avatarUploadError = '';
    this.isAvatarDropActive = false;
    this.avatarDragDepth = 0;
  }

  onAvatarUrlInput(): void {
    this.avatarFileName = '';
    this.avatarUploadError = '';
    this.isAvatarDropActive = false;
    this.avatarDragDepth = 0;
  }

  openAvatarPicker(element: HTMLInputElement): void {
    if (this.isSaving) {
      return;
    }
    element.click();
  }

  private processAvatarFile(file?: File | null, onComplete?: () => void): void {
    if (!file) {
      onComplete?.();
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.avatarUploadError = 'Only image files are supported.';
      onComplete?.();
      return;
    }

    if (file.size > this.maxAvatarSizeBytes) {
      this.avatarUploadError = `Please choose an image under ${this.maxAvatarSizeMb} MB.`;
      onComplete?.();
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        this.avatarUploadError = 'Unable to read the selected file.';
        onComplete?.();
        return;
      }
      this.userForm.patchValue({ avatar: result });
      this.userForm.get('avatar')?.markAsDirty();
      this.userForm.markAsDirty();
      this.avatarFileName = file.name;
      this.avatarUploadError = '';
      onComplete?.();
    };
    reader.onerror = () => {
      this.avatarUploadError = 'Something went wrong while reading the file.';
      onComplete?.();
    };
    reader.readAsDataURL(file);
  }

  private ensureRoleOption(user: AdminUser): void {
    if (!user?.role_id && user?.role_id !== 0) {
      return;
    }
    const roleId = user.role_id.toString();
    const exists = this.roleOptions.some(option => option.roleId === roleId);
    if (!exists) {
      this.roleOptions.push({
        label: user.role || `Role ${roleId}`,
        roleId
      });
    }
  }

  private buildPayload(): Record<string, unknown> {
    const value = this.userForm.value;
    const payload: Record<string, unknown> = {};

    if (typeof value['username'] !== 'undefined') {
      payload['username'] = value['username']?.trim();
    }
    if (typeof value['email'] !== 'undefined') {
      payload['email'] = value['email']?.trim();
    }
    if (typeof value['gender'] !== 'undefined') {
      payload['gender'] = value['gender'] || null;
    }
    if (typeof value['avatar'] !== 'undefined') {
      payload['avatar'] = value['avatar'] || null;
    }
    if (typeof value['role_id'] !== 'undefined') {
      payload['role_id'] = this.normalizeRoleId(value['role_id']);
    }
    if (typeof value['is_checking'] !== 'undefined') {
      payload['is_checking'] = value['is_checking'];
    }
    if (typeof value['phone'] !== 'undefined') {
      payload['phone'] = value['phone'];
    }

    return payload;
  }

  private normalizeRoleId(roleId: string | number): string | number {
    if (roleId === null || roleId === undefined) {
      return '';
    }

    if (typeof roleId === 'number') {
      return roleId;
    }

    const trimmed = roleId.trim();
    if (!trimmed) {
      return '';
    }

    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? trimmed : parsed;
  }
}

