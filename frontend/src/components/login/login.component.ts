import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { CommonModule } from '@angular/common';

import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule
  ],
  template: `
    <section class="login-wrapper">
      <mat-card>
        <mat-card-header>
          <mat-card-title>Admin Sign In</mat-card-title>
          <mat-card-subtitle>Enter credentials to continue</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          @if (errorMessage(); as error) {
            <div class="error-message">
              {{ error }}
            </div>
          }
          
          <form [formGroup]="form" (ngSubmit)="onSubmit()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Username</mat-label>
              <input 
                matInput 
                formControlName="username" 
                autocomplete="username"
                [disabled]="isLoading()" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Password</mat-label>
              <input 
                matInput 
                type="password" 
                formControlName="password" 
                autocomplete="current-password"
                [disabled]="isLoading()" />
            </mat-form-field>

            <button 
              mat-flat-button 
              color="primary" 
              class="full-width" 
              type="submit" 
              [disabled]="form.invalid || isLoading()">
              {{ isLoading() ? 'Signing in...' : 'Sign In' }}
            </button>
          </form>
        </mat-card-content>
      </mat-card>
    </section>
  `,
  styles: [
    `
      .login-wrapper {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: calc(100vh - 128px);
        padding: 2rem;
      }

      mat-card {
        width: min(100%, 420px);
      }

      .full-width {
        width: 100%;
      }

      form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin-top: 1rem;
      }

      .error-message {
        padding: 0.75rem 1rem;
        margin-bottom: 1rem;
        background-color: #fdecea;
        border: 1px solid #f5c6cb;
        border-radius: 4px;
        color: #721c24;
        font-size: 0.875rem;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private returnUrl = '/dashboard';

  readonly form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required]
  });

  readonly isLoading = computed(() => this.authService.isBusy());
  readonly errorMessage = computed(() => this.authService.errorSignal());

  ngOnInit(): void {
    // Read returnUrl from query params if provided
    this.route.queryParams.subscribe(params => {
      this.returnUrl = params['returnUrl'] || '/dashboard';
    });
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      return;
    }

    const { username, password } = this.form.getRawValue();
    const success = await this.authService.login(username, password);

    if (success) {
      await this.router.navigate([this.returnUrl]);
    }
  }
}
