import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ChatbotComponent } from './components/chatbot/chatbot.component';
import { PaperlessComponent } from './components/paperless/paperless.component';
import { Subscription, filter } from 'rxjs';
import { AppearanceService } from './ui/appearance.service';

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

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.checkChatbotVisibility();
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.checkChatbotVisibility();
      });
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
  }

  private checkChatbotVisibility(): void {
    const currentUser = localStorage.getItem('currentUser') || localStorage.getItem('user');
    const isLoginPage = this.router.url === '/login' || this.router.url === '/';
    this.showChatbot = !!currentUser && !isLoginPage;
  }
}


