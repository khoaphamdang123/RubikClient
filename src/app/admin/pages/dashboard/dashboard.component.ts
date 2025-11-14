import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import axios from 'axios';
import { environment } from '../../../../environments/environment';

interface DashboardData {
  userStatistics: {
    totalUsers: number;
    adminUsers: number;
    regularUsers: number;
    recentRegistrations: number;
  };
  sessionStatistics: {
    activeSessions: number;
    recentSessions: number;
  };
  deviceStatistics: {
    totalDevices: number;
  };
  roomStatistics: {
    totalRooms: number;
    activeRooms: number;
  };
  rubikStatistics: {
    totalProblems: number;
  };
  currentAdmin: {
    id: string;
    username: string;
    email: string;
    role: string;
    lastActive: string;
  };
  timestamp: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  dashboardData: DashboardData | null = null;
  isLoading = true;
  error: string | null = null;
  lastUpdated: Date | null = null;

  constructor() {}

  async ngOnInit(): Promise<void> {
    await this.loadDashboardData();
  }

  async loadDashboardData(): Promise<void> {
    try {
      this.isLoading = true;
      this.error = null;
      const token = localStorage.getItem('TOKEN');
      
      const response = await axios.get(`${environment.server_url}/admin/dashboard`, {
        headers: { 'Authorization': token }
      });

      if (response.data.status && response.data.data) {
        this.dashboardData = response.data.data;
        this.lastUpdated = new Date();
      } else {
        throw new Error(response.data.message || 'Failed to load dashboard data');
      }
    } catch (error: any) {
      console.error('Error loading dashboard data:', error);
      this.error = error.response?.data?.message || error.message || 'Failed to load dashboard data';
      this.dashboardData = null;
    } finally {
      this.isLoading = false;
    }
  }

  refreshDashboard(): void {
    if (!this.isLoading) {
      this.loadDashboardData();
    }
  }

  get statCards() {
    if (!this.dashboardData) return [];
    
    return [
      {
        label: 'Total Users',
        value: this.dashboardData.userStatistics.totalUsers,
        icon: '👥',
        accent: 'accent-indigo',
        description: 'Registered community members'
      },
      {
        label: 'Active Sessions',
        value: this.dashboardData.sessionStatistics.activeSessions,
        icon: '🔐',
        accent: 'accent-emerald',
        description: 'Currently active sessions'
      },
      {
        label: 'Total Devices',
        value: this.dashboardData.deviceStatistics.totalDevices,
        icon: '📱',
        accent: 'accent-violet',
        description: 'Registered devices'
      },
      {
        label: 'Rubik Problems',
        value: this.dashboardData.rubikStatistics.totalProblems,
        icon: '🎲',
        accent: 'accent-amber',
        description: 'Total problem sets'
      }
    ];
  }

  get userBreakdownCards() {
    if (!this.dashboardData) return [];
    
    return [
      {
        label: 'Admin Users',
        value: this.dashboardData.userStatistics.adminUsers,
        icon: '👑',
        accent: 'accent-rose',
        description: 'Administrative accounts'
      },
      {
        label: 'Regular Users',
        value: this.dashboardData.userStatistics.regularUsers,
        icon: '👤',
        accent: 'accent-blue',
        description: 'Standard user accounts'
      },
      {
        label: 'Recent Registrations',
        value: this.dashboardData.userStatistics.recentRegistrations,
        icon: '✨',
        accent: 'accent-green',
        description: 'Last 24 hours'
      },
      {
        label: 'Recent Sessions',
        value: this.dashboardData.sessionStatistics.recentSessions,
        icon: '🔄',
        accent: 'accent-cyan',
        description: 'Last 24 hours'
      }
    ];
  }

  get roomCards() {
    if (!this.dashboardData) return [];
    
    return [
      {
        label: 'Total Rooms',
        value: this.dashboardData.roomStatistics.totalRooms,
        icon: '🏠',
        accent: 'accent-purple',
        description: 'All room instances'
      },
      {
        label: 'Active Rooms',
        value: this.dashboardData.roomStatistics.activeRooms,
        icon: '🟢',
        accent: 'accent-teal',
        description: 'Currently active'
      }
    ];
  }

  get currentAdminInfo() {
    return this.dashboardData?.currentAdmin || null;
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  }

  get timestampFormatted(): string {
    if (!this.dashboardData?.timestamp) return '';
    try {
      const date = new Date(this.dashboardData.timestamp);
      return date.toLocaleString();
    } catch {
      return this.dashboardData.timestamp;
    }
  }
}

