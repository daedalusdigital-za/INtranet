import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ChatbotComponent } from './components/chatbot/chatbot.component';
import { PaperlessComponent } from './components/paperless/paperless.component';
import { Subscription, filter } from 'rxjs';
import { AppearanceService } from './ui/appearance.service';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ChatbotComponent, PaperlessComponent, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'Frontend';
  showChatbot = false;
  private routerSubscription?: Subscription;
  // Created here so the saved light/dark choice and "same as this computer" also apply to
  // pages without the navbar, such as sign-in.
  private readonly appearance = inject(AppearanceService);
  private readonly auth = inject(AuthService);
  showPaperless = false;

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.checkChatbotVisibility();
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.checkChatbotVisibility();
      });
    // Permissions refresh shortly after sign-in; re-evaluate so Welly appears/disappears accordingly
    this.userSubscription = this.auth.currentUser$.subscribe(() => this.checkChatbotVisibility());
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
    this.userSubscription?.unsubscribe();
  }
  private userSubscription?: Subscription;

  private checkChatbotVisibility(): void {
    const currentUser = localStorage.getItem('currentUser') || localStorage.getItem('user');
    const isLoginPage = this.router.url === '/login' || this.router.url === '/';
    this.showPaperless = !!currentUser && !isLoginPage;
    // Welly (AI assistant) is a module like any other: only for people ticked for "AI Assistant" (admins always)
    this.showChatbot = this.showPaperless && this.auth.hasModulePermission('ai');
  }
}


