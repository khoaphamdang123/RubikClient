import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HandleService } from '../../../services/handle.service';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
  providers: [HandleService]
})
export class ProfileComponent implements OnInit {
  user = JSON.parse(localStorage.getItem('ACCOUNT') as string);
  role!: string;
  isOnline: boolean = false;
  isOwnProfile: boolean = false;

  constructor(
    private handleService: HandleService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.getProfilePage();
    this.role = this.convertRole(this.user.role_id as number);
    this.checkIfOwnProfile();
    this.checkOnlineStatus();
  }

  convertRole(role_id: number): string {
    let role = '';
    switch (role_id) {
      case 0:
        role = 'User';
        break;
      case 1:
        role = 'Admin';
        break;
      default:
        role = 'User';
        break;
    }
    return role;
  }

  backHomePage(): void {
    this.handleService.backHomePage();
  }

  getProfilePage(): void {
    const username = this.route.snapshot.paramMap.get('username');
    this.handleService.getProfilePage(username as string);
  }

  checkIfOwnProfile(): void {
    const urlUsername = this.route.snapshot.paramMap.get('username');
    this.isOwnProfile = urlUsername === this.user.username;
  }

  checkOnlineStatus(): void {
    // Check if user was active in the last 5 minutes
    if (this.user.last_action) {
      const lastActionDate = new Date(this.user.last_action);
      const now = new Date();
      const diffMinutes = (now.getTime() - lastActionDate.getTime()) / (1000 * 60);
      this.isOnline = diffMinutes < 5;
    }
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffTime / (1000 * 60));

    // If less than 1 minute ago
    if (diffMinutes < 1) {
      return 'Just now';
    }
    // If less than 1 hour ago
    else if (diffMinutes < 60) {
      return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
    }
    // If less than 24 hours ago
    else if (diffHours < 24) {
      return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    }
    // If less than 7 days ago
    else if (diffDays < 7) {
      return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    }
    // If less than 30 days ago
    else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
    }
    // If less than 365 days ago
    else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} ${months === 1 ? 'month' : 'months'} ago`;
    }
    // Otherwise show years
    else {
      const years = Math.floor(diffDays / 365);
      return `${years} ${years === 1 ? 'year' : 'years'} ago`;
    }
  }

  editProfile(): void {
    // Navigate to edit profile page or open edit modal
    this.router.navigate(['/edit-profile', this.user.username]);
  }
}
