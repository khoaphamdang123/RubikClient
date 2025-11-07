import { Component, OnInit, Output, EventEmitter, Input } from '@angular/core';

interface ColorOption {
  name: string;
  value: string;
  displayName: string;
}

@Component({
  selector: 'app-color-palette',
  standalone: true,
  imports: [],
  templateUrl: './color-palette.component.html',
  styleUrl: './color-palette.component.scss'
})
export class ColorPaletteComponent implements OnInit {
  backgroundColor: string = 'transparent';
  
  @Input() color_disable!: string[];
  @Output("update-color") color: EventEmitter<string> = new EventEmitter<string>();

  colorOptions: ColorOption[] = [
    { name: 'White', value: 'whitesmoke', displayName: 'White' },
    { name: 'Orange', value: 'orange', displayName: 'Orange' },
    { name: 'Green', value: 'green', displayName: 'Green' },
    { name: 'Red', value: 'red', displayName: 'Red' },
    { name: 'Blue', value: 'blue', displayName: 'Blue' },
    { name: 'Yellow', value: 'yellow', displayName: 'Yellow' }
  ];

  ngOnInit(): void {
    // Initialize with first color if needed
  }

  getColorName(colorValue: string): string {
    if (colorValue === 'transparent') {
      return 'None Selected';
    }
    const colorOption = this.colorOptions.find(c => c.value === colorValue);
    return colorOption ? colorOption.displayName : 'Unknown';
  }

  getIndexColor(color: string): number {
    const colorMap: { [key: string]: number } = {
      'whitesmoke': 0,
      'orange': 1,
      'green': 2,
      'red': 3,
      'blue': 4,
      'yellow': 5
    };
    return colorMap[color] ?? -1;
  }

  isColorDisabled(pickedColor: string): boolean {
    if (!this.color_disable) {
      return false;
    }
    const idx = this.getIndexColor(pickedColor);
    return idx !== -1 && this.color_disable[idx] === 'true';
  }

  changeBackgroundColor(color: string): void {
    if (this.isColorDisabled(color)) {
      return;
    }
    this.backgroundColor = color;
    this.color.emit(this.backgroundColor);
  }
}
