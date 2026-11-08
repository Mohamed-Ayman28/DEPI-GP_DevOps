import { Component } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login-signup',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterLink],
  templateUrl: './login-signup.component.html',
  styleUrls: ['./login-signup.component.css']
})
export class LoginSignupComponent {
  // Signup form fields
  name = "";
  email = "";
  password = "";
  phone_number = "";
  
  // Login form fields
  loginEmail = "";
  loginPassword = "";
  
  isLogin = false;

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.isLogin = this.route.snapshot.data['mode'] === 'login';
  }

  setMode(mode: 'login' | 'signup'): void {
    this.isLogin = mode === 'login';
    if (this.isLogin) {
      this.name = "";
      this.email = "";
      this.password = "";
      this.phone_number = "";
    } else {
      this.loginEmail = "";
      this.loginPassword = "";
    }
  }

  signup(): void {
    if (!this.name || !this.email || !this.password || !this.phone_number) {
      alert('Please fill in all required fields');
      return;
    }

    this.auth.signup({
      name: this.name,
      email: this.email,
      password: this.password,
      phone_number: this.phone_number
    }).subscribe({ 
      next: (res) => {
        this.router.navigate(['/services']);
      }, 
      error: (err) => {
        console.error('Signup error:', err);
        alert('Signup failed: ' + (err.error?.detail || err.message || 'Unknown error'));
      }
    });
  }

  login(): void {
    if (!this.loginEmail || !this.loginPassword) {
      alert('Please enter both email and password');
      return;
    }

    this.auth.login({ email: this.loginEmail, password: this.loginPassword }).subscribe({ 
      next: (res) => {
        this.router.navigate([this.auth.hasRole(['admin']) ? '/admin/dashboard' : '/services']);
      }, 
      error: (err) => {
        console.error('Login error:', err);
        alert('Login failed: ' + (err.error?.detail || err.message || 'Invalid credentials'));
      }
    });
  }
}