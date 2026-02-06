import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ChatbotComponent } from './components/chatbot/chatbot.component';
import { AnimatedIconBackgroundComponent } from './components/shared/animated-icon-background/animated-icon-background.component';
import { Subscription, filter } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ChatbotComponent, CommonModule, AnimatedIconBackgroundComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'Frontend';
  showChatbot = false;
  showAnimatedBackground = true;
  backgroundTheme: 'light' | 'dark' = 'light';
  private routerSubscription?: Subscription;

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


