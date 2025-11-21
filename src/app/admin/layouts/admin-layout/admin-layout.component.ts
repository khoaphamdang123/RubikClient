import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { ThemeService, ThemeMode } from '../../../services/theme.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss'
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
  isSidebarOpen = true;
  isMobileMenuOpen = false;
  currentRoute = '';
  user: any = null;
  private routerSubscription?: Subscription;
  private themeSubscription?: Subscription;
  currentTheme: ThemeMode = 'light';

  menuItems = [
    {
      label: 'Dashboard',
      icon: '📊',
      route: '/admin/dashboard',
      active: false
    },
    {
      label: 'User Management',
      icon: '👥',
      route: '/admin/users',
      active: false
    },
    {
      label: 'Product Management',
      icon: '📦',
      route: '/admin/products',
      active: false
    },
    {
      label: 'Category Management',
      icon: '🏷️',
      route: '/admin/categories',
      active: false
    },
    {
      label: 'Rubik Solve Management',
      icon: '🎲',
      route: '/admin/rubik-solves',
      active: false
    },
    {
      label: 'Rubik Type Management',
      icon: '🧱',
      route: '/admin/rubik-types',
      active: false
    }
  ];

  constructor(
    private router: Router,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.loadUserData();
    this.updateActiveRoute();
    this.currentTheme = this.themeService.currentTheme;
    this.themeSubscription = this.themeService.themeChanges.subscribe((theme: ThemeMode) => {
      this.currentTheme = theme;
    });
    
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.updateActiveRoute();
      });
  }

  ngOnDestroy(): void {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
    if (this.themeSubscription) {
      this.themeSubscription.unsubscribe();
    }
  }

  loadUserData(): void {
    try {
      const accountData = localStorage.getItem('ACCOUNT');
      if (accountData) {
        this.user = JSON.parse(accountData);
      }
    } catch (error) {
      console.error('Error parsing user account data:', error);
      this.user = null;
    }
  }

  updateActiveRoute(): void {
    this.currentRoute = this.router.url;
    this.menuItems.forEach(item => {
      item.active = this.currentRoute.startsWith(item.route);
    });
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen = false;
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
    this.closeMobileMenu();
  }

  signOut(): void {
    localStorage.removeItem('TOKEN');
    localStorage.removeItem('ACCOUNT');
    localStorage.removeItem('AVATAR');
    this.router.navigate(['/login']);
  }

   signOutAdmin()
  {
    localStorage.removeItem("TOKEN");
    this.closeMobileMenu();
    this.router.navigate(["/admin/login"]);    
  }

  navigateToClient(): void {
    this.router.navigate(['/products']);
  }

  getCurrentPageTitle(): string {
    const activeItem = this.menuItems.find(item => item.active);
    return activeItem ? activeItem.label : 'Admin Panel';
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  get themeToggleLabel(): string {
    return this.currentTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode';
  }

  get themeToggleIcon(): string {
    return this.currentTheme === 'light' ? '🌙' : '☀️';
  }
}

