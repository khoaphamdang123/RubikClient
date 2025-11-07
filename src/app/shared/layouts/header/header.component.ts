import { Component, OnInit, ElementRef, ViewChild, AfterViewInit, OnDestroy, HostListener } from '@angular/core';
import { Router } from '@angular/router';
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnInit, AfterViewInit, OnDestroy
{ 
  avatar=localStorage.getItem("AVATAR");
  user=JSON.parse(localStorage.getItem("ACCOUNT") as string);
  isMobileMenuOpen = false;
  isDropdownOpen = false;
  dropdownPosition = { top: '0px', right: '0px' };

  @ViewChild('dropdownButton', { static: false }) dropdownButton!: ElementRef;
  @ViewChild('dropdownContent', { static: false }) dropdownContent!: ElementRef;

  private resizeListener?: () => void;

  constructor(private router:Router)
  {
  }
  ngOnInit(): void 
  {
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
    if (this.isDropdownOpen && 
        this.dropdownButton?.nativeElement && 
        !this.dropdownButton.nativeElement.contains(event.target as Node) &&
        this.dropdownContent?.nativeElement &&
        !this.dropdownContent.nativeElement.contains(event.target as Node)) {
      this.closeDropdown();
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

  closeDropdown() {
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
    var route=`/profile/${this.user.username}`;
    this.closeDropdown();
    this.closeMobileMenu();
    this.router.navigate([route]);
  }

  navigateDevices()
  {
    var route = `/device/${this.user.username}`;
    this.closeDropdown();
    this.closeMobileMenu();
    this.router.navigate([route]);
  }
}
