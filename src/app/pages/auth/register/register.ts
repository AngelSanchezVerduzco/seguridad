import { Component } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';

@Component({
  selector: 'app-register',
  imports: [ButtonModule, InputTextModule],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class Register {

}
