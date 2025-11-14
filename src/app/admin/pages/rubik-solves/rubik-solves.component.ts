import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PopupService } from '../../../../services/popup.service';
import Swal from 'sweetalert2';
import axios from 'axios';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-rubik-solves',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rubik-solves.component.html',
  styleUrl: './rubik-solves.component.scss'
})
export class RubikSolvesComponent implements OnInit {
  rubikSolves: any[] = [];
  filteredRubikSolves: any[] = [];
  isLoading = false;
  searchTerm = '';
  selectedSolve: any = null;
  isDetailModalOpen = false;

  constructor(private popupService: PopupService) {}

  ngOnInit(): void {
    this.loadRubikSolves();
  }

  async loadRubikSolves(): Promise<void> {
    try {
      this.isLoading = true;
      const token = localStorage.getItem('TOKEN');
      const response = await axios.get(`${environment.server_url}/admin/rubik-solves`, {
        headers: { 'Authorization': token }
      });
      this.rubikSolves = response.data || [];
      this.filteredRubikSolves = [...this.rubikSolves];
    } catch (error: any) {
      console.error('Error loading rubik solves:', error);
      if (error.response?.status === 401) {
        this.popupService.AlertErrorDialog('Unauthorized access', 'Error');
        localStorage.removeItem('TOKEN');
        window.location.href = '/login';
      } else {
        // Fallback: use mock data or empty array
        this.rubikSolves = [];
        this.filteredRubikSolves = [];
      }
    } finally {
      this.isLoading = false;
    }
  }

  onSearch(): void {
    if (!this.searchTerm.trim()) {
      this.filteredRubikSolves = [...this.rubikSolves];
      return;
    }

    const term = this.searchTerm.toLowerCase();
    this.filteredRubikSolves = this.rubikSolves.filter(solve =>
      solve.user?.username?.toLowerCase().includes(term) ||
      solve.rubik_name?.toLowerCase().includes(term) ||
      solve.status?.toLowerCase().includes(term)
    );
  }

  openDetailModal(solve: any): void {
    this.selectedSolve = solve;
    this.isDetailModalOpen = true;
  }

  closeDetailModal(): void {
    this.isDetailModalOpen = false;
    this.selectedSolve = null;
  }

  async deleteRubikSolve(solve: any): Promise<void> {
    const result = await Swal.fire({
      title: 'Confirm Delete',
      text: `Are you sure you want to delete this rubik solve record?`,
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
        `${environment.server_url}/admin/rubik-solves/${solve.id}`,
        { headers: { 'Authorization': token } }
      );
      this.popupService.AlertSuccessDialog('Rubik solve record deleted successfully', 'Success');
      await this.loadRubikSolves();
    } catch (error: any) {
      console.error('Error deleting rubik solve:', error);
      this.popupService.AlertErrorDialog(
        error.response?.data?.message || 'Failed to delete rubik solve record',
        'Error'
      );
    }
  }

  getStatusBadgeClass(status: string): string {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower.includes('complete') || statusLower.includes('solved')) {
      return 'badge-success';
    } else if (statusLower.includes('progress') || statusLower.includes('solving')) {
      return 'badge-warning';
    } else {
      return 'badge-info';
    }
  }

  formatDate(date: string | Date, full: boolean = false): string {
    if (!date) return 'N/A';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'N/A';
    
    if (full) {
      return d.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } else {
      return d.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }
}

