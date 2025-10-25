import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { of, BehaviorSubject } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { LoginComponent } from './login.component';
import { AuthService } from '../../services/auth.service';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockRouter: jasmine.SpyObj<Router>;
  let queryParams$: BehaviorSubject<{ returnUrl?: string }>;
  let isBusySignal: ReturnType<typeof signal<boolean>>;
  let errorSignal: ReturnType<typeof signal<string | null>>;

  beforeEach(async () => {
    queryParams$ = new BehaviorSubject<{ returnUrl?: string }>({});
    isBusySignal = signal(false);
    errorSignal = signal(null);

    mockAuthService = jasmine.createSpyObj('AuthService', ['login'], {
      isBusy: isBusySignal.asReadonly(),
      errorSignal: errorSignal.asReadonly()
    });

    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [LoginComponent, NoopAnimationsModule],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
        {
          provide: ActivatedRoute,
          useValue: { queryParams: queryParams$ }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('Initialization', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize form with empty username and password', () => {
      expect(component.form.value).toEqual({
        username: '',
        password: ''
      });
    });

    it('should have form invalid when fields are empty', () => {
      expect(component.form.invalid).toBe(true);
    });

    it('should have form valid when both fields are filled', () => {
      component.form.patchValue({
        username: 'admin',
        password: 'password123'
      });
      expect(component.form.valid).toBe(true);
    });
  });

  describe('Form Validation', () => {
    it('should require username', () => {
      const usernameControl = component.form.controls.username;
      expect(usernameControl.hasError('required')).toBe(true);

      usernameControl.setValue('admin');
      expect(usernameControl.hasError('required')).toBe(false);
    });

    it('should require password', () => {
      const passwordControl = component.form.controls.password;
      expect(passwordControl.hasError('required')).toBe(true);

      passwordControl.setValue('password123');
      expect(passwordControl.hasError('required')).toBe(false);
    });

    it('should disable submit button when form is invalid', () => {
      const submitButton = fixture.nativeElement.querySelector('button[type="submit"]');
      expect(submitButton.disabled).toBe(true);
    });

    it('should enable submit button when form is valid', () => {
      component.form.patchValue({
        username: 'admin',
        password: 'password123'
      });
      fixture.detectChanges();

      const submitButton = fixture.nativeElement.querySelector('button[type="submit"]');
      expect(submitButton.disabled).toBe(false);
    });
  });

  describe('Login Flow', () => {
    beforeEach(() => {
      component.form.patchValue({
        username: 'admin',
        password: 'password123'
      });
    });

    it('should call authService.login with form values on submit', async () => {
      mockAuthService.login.and.returnValue(Promise.resolve(true));

      await component.onSubmit();

      expect(mockAuthService.login).toHaveBeenCalledWith('admin', 'password123');
    });

    it('should navigate to dashboard on successful login without returnUrl', async () => {
      mockAuthService.login.and.returnValue(Promise.resolve(true));

      await component.onSubmit();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard']);
    });

    it('should navigate to returnUrl on successful login when provided', async () => {
      queryParams$.next({ returnUrl: '/expenses' });
      mockAuthService.login.and.returnValue(Promise.resolve(true));

      await component.onSubmit();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/expenses']);
    });

    it('should not navigate on failed login', async () => {
      mockAuthService.login.and.returnValue(Promise.resolve(false));

      await component.onSubmit();

      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('should do nothing if form is invalid on submit', async () => {
      component.form.patchValue({
        username: '',
        password: ''
      });

      await component.onSubmit();

      expect(mockAuthService.login).not.toHaveBeenCalled();
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('should display loading state from authService', () => {
      isBusySignal.set(true);
      fixture.detectChanges();

      const compiled = fixture.nativeElement;
      expect(compiled.textContent).toContain('Signing in...');
    });

    it('should disable form controls while loading', () => {
      component.form.patchValue({
        username: 'admin',
        password: 'password123'
      });
      isBusySignal.set(true);
      fixture.detectChanges();

      const submitButton = fixture.nativeElement.querySelector('button[type="submit"]');
      expect(submitButton.disabled).toBe(true);
    });

    it('should show normal button text when not loading', () => {
      isBusySignal.set(false);
      fixture.detectChanges();

      const compiled = fixture.nativeElement;
      expect(compiled.textContent).toContain('Sign In');
    });
  });

  describe('Error Display', () => {
    it('should display error message from authService', () => {
      const errorMessage = 'Invalid username or password';
      errorSignal.set(errorMessage);
      fixture.detectChanges();

      const compiled = fixture.nativeElement;
      expect(compiled.textContent).toContain(errorMessage);
    });

    it('should not display error when authService has no error', () => {
      errorSignal.set(null);
      fixture.detectChanges();

      const errorElement = fixture.nativeElement.querySelector('.error-message');
      expect(errorElement).toBeFalsy();
    });

    it('should display error in a styled error container', () => {
      const errorMessage = 'Session expired';
      errorSignal.set(errorMessage);
      fixture.detectChanges();

      const errorElement = fixture.nativeElement.querySelector('.error-message');
      expect(errorElement).toBeTruthy();
      expect(errorElement.textContent).toContain(errorMessage);
    });
  });

  describe('UI Elements', () => {
    it('should render card title', () => {
      const compiled = fixture.nativeElement;
      expect(compiled.querySelector('mat-card-title')?.textContent).toContain('Admin Sign In');
    });

    it('should render card subtitle', () => {
      const compiled = fixture.nativeElement;
      expect(compiled.querySelector('mat-card-subtitle')?.textContent).toContain('Enter credentials to continue');
    });

    it('should render username input field', () => {
      const usernameInput = fixture.nativeElement.querySelector('input[formControlName="username"]');
      expect(usernameInput).toBeTruthy();
      expect(usernameInput.getAttribute('autocomplete')).toBe('username');
    });

    it('should render password input field', () => {
      const passwordInput = fixture.nativeElement.querySelector('input[formControlName="password"]');
      expect(passwordInput).toBeTruthy();
      expect(passwordInput.getAttribute('type')).toBe('password');
      expect(passwordInput.getAttribute('autocomplete')).toBe('current-password');
    });

    it('should not render placeholder hint after implementation', () => {
      const compiled = fixture.nativeElement;
      expect(compiled.textContent).not.toContain('UI wiring to the new auth service arrives with task T048');
    });
  });

  describe('Integration', () => {
    it('should handle complete login flow with all states', async () => {
      // Start with no error, not busy
      isBusySignal.set(false);
      errorSignal.set(null);
      fixture.detectChanges();

      // Fill form
      component.form.patchValue({
        username: 'admin',
        password: 'password123'
      });
      fixture.detectChanges();

      // Simulate busy state during login
      isBusySignal.set(true);
      mockAuthService.login.and.returnValue(Promise.resolve(true));
      
      const loginPromise = component.onSubmit();
      fixture.detectChanges();

      // Should show loading state
      expect(fixture.nativeElement.textContent).toContain('Signing in...');

      // Complete login
      await loginPromise;
      
      // Should navigate
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard']);
    });

    it('should preserve returnUrl through login flow', async () => {
      const returnUrl = '/groups/5';
      queryParams$.next({ returnUrl });
      
      component.form.patchValue({
        username: 'admin',
        password: 'password123'
      });

      mockAuthService.login.and.returnValue(Promise.resolve(true));
      await component.onSubmit();

      expect(mockRouter.navigate).toHaveBeenCalledWith([returnUrl]);
    });
  });
});
