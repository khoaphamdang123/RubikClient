import { Component, OnInit, ElementRef, ViewChild, AfterViewInit, OnDestroy, HostListener } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnInit, AfterViewInit, OnDestroy
{ 
  avatar = localStorage.getItem("AVATAR");
  user: any = null;
  isMobileMenuOpen = false;
  isDropdownOpen = false;
  dropdownPosition = { top: '0px', right: '0px' };

  @ViewChild('dropdownButton', { static: false }) dropdownButton!: ElementRef;
  @ViewChild('dropdownContent', { static: false }) dropdownContent!: ElementRef;
  @ViewChild('mobileMenuBtn', { static: false }) mobileMenuBtn!: ElementRef;
  @ViewChild('mobileMenu', { static: false }) mobileMenu!: ElementRef;

  private resizeListener?: () => void;

  constructor(private router:Router)
  {
  }
  ngOnInit(): void 
  {
    try {
      const accountData = localStorage.getItem("ACCOUNT");
      if (accountData) {
        this.user = JSON.parse(accountData);
      }
    } catch (error) {
      console.error('Error parsing user account data:', error);
      this.user = null;      
    }
  }

  ngAfterViewInit(): void {
    // Calculate position after view initialization
    if (this.dropdownButton) {
      this.calculateDropdownPosition();
    }
    // Listen for window resize
    this.resizeListener = () => {
      if (this.isDropdownOpen) {
        this.calculateDropdownPosition();
      }
      // Close mobile menu when resizing to desktop
      if (window.innerWidth >= 768 && this.isMobileMenuOpen) {
        this.closeMobileMenu();
      }
    };
    window.addEventListener('resize', this.resizeListener);
  }

  ngOnDestroy(): void {
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
    }
  }

  calculateDropdownPosition() {
    if (this.dropdownButton?.nativeElement) {
      const buttonRect = this.dropdownButton.nativeElement.getBoundingClientRect();
      this.dropdownPosition = {
        top: `${buttonRect.bottom + 8}px`,
        right: `${window.innerWidth - buttonRect.right}px`
      };
    }
  }
 
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    // Close dropdown if clicking outside
    if (this.isDropdownOpen && 
        this.dropdownButton?.nativeElement && 
        !this.dropdownButton.nativeElement.contains(event.target as Node) &&
        this.dropdownContent?.nativeElement &&
        !this.dropdownContent.nativeElement.contains(event.target as Node)) {
      this.closeDropdown();
    }
    
    // Close mobile menu if clicking outside (only on mobile)
    if (window.innerWidth < 768 && this.isMobileMenuOpen &&
        this.mobileMenuBtn?.nativeElement &&
        !this.mobileMenuBtn.nativeElement.contains(event.target as Node) &&
        this.mobileMenu?.nativeElement &&
        !this.mobileMenu.nativeElement.contains(event.target as Node)) {
      this.closeMobileMenu();
    }
  }

  toggleMobileMenu() {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
    if (this.isMobileMenuOpen) {
      this.isDropdownOpen = false;
    }
  }

  closeMobileMenu() {
    this.isMobileMenuOpen = false;
  }

  toggleDropdown() {
    this.isDropdownOpen = !this.isDropdownOpen;
    if (this.isDropdownOpen) {
      // Recalculate position when opening
      setTimeout(() => this.calculateDropdownPosition(), 0);
    }
  }
  
  closeDropdown() 
  {
    this.isDropdownOpen = false;
  }

  signOut()
  {
    localStorage.removeItem("TOKEN");
    this.closeDropdown();
    this.closeMobileMenu();
    this.router.navigate(["/login"]);    
  }
  
  navigateProfile()
  {
    if (this.user?.username) {
      const route = `/profile/${this.user.username}`;
      this.closeDropdown();      
      this.closeMobileMenu();      
      this.router.navigate([route]);      
    }
  }

  navigateDevices()
  {
    if (this.user?.username) {
      const route = `/device/${this.user.username}`;
      this.closeDropdown();
      this.closeMobileMenu();
      this.router.navigate([route]);      
    }
  }

  navigateAdmin()
  {
    this.closeDropdown();
    this.closeMobileMenu();
    this.router.navigate(['/admin']);      
  }
}
