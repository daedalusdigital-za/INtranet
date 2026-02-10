import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Subscription, debounceTime, Subject } from 'rxjs';
import { CollaborativeDocsService } from '../../../services/collaborative-docs.service';
import { AuthService } from '../../../services/auth.service';
import { DocumentDetail, UserPresence } from '../../../models/collaborative-doc.model';

// Mammoth for Word document import
import * as mammoth from 'mammoth';

// Tiptap imports
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';

// Yjs imports
import * as Y from 'yjs';
import { Collaboration } from '@tiptap/extension-collaboration';

@Component({
  selector: 'app-doc-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatChipsModule,
    MatDividerModule,
    MatTabsModule,
    MatSelectModule,
    MatFormFieldModule
  ],
  template: `
    <div class="editor-container" [class.loading]="loading">
      <!-- Title Bar -->
      <div class="title-bar">
        <div class="title-bar-left">
          <button mat-icon-button routerLink="/docs" matTooltip="Back to Documents">
            <mat-icon>arrow_back</mat-icon>
          </button>
          <div class="document-icon">
            <mat-icon>description</mat-icon>
          </div>
          <div class="document-info">
            <input type="text" 
                   class="title-input" 
                   [(ngModel)]="documentTitle" 
                   (blur)="saveTitle()"
                   (keyup.enter)="saveTitle()"
                   placeholder="Untitled Document">
            <div class="menu-bar">
              <button mat-button [matMenuTriggerFor]="fileMenu">File</button>
              <mat-menu #fileMenu="matMenu">
                <button mat-menu-item (click)="triggerImportDocx()">
                  <mat-icon>upload_file</mat-icon>
                  <span>Import Word Document</span>
                </button>
                <button mat-menu-item (click)="exportAsHtml()">
                  <mat-icon>download</mat-icon>
                  <span>Export as HTML</span>
                </button>
                <mat-divider></mat-divider>
                <button mat-menu-item (click)="print()">
                  <mat-icon>print</mat-icon>
                  <span>Print</span>
                </button>
              </mat-menu>
              <button mat-button [matMenuTriggerFor]="editMenu">Edit</button>
              <mat-menu #editMenu="matMenu">
                <button mat-menu-item (click)="undo()">
                  <mat-icon>undo</mat-icon>
                  <span>Undo</span>
                </button>
                <button mat-menu-item (click)="redo()">
                  <mat-icon>redo</mat-icon>
                  <span>Redo</span>
                </button>
                <mat-divider></mat-divider>
                <button mat-menu-item (click)="selectAll()">
                  <mat-icon>select_all</mat-icon>
                  <span>Select All</span>
                </button>
              </mat-menu>
              <button mat-button [matMenuTriggerFor]="viewMenu">View</button>
              <mat-menu #viewMenu="matMenu">
                <button mat-menu-item (click)="toggleFullscreen()">
                  <mat-icon>fullscreen</mat-icon>
                  <span>Fullscreen</span>
                </button>
              </mat-menu>
            </div>
          </div>
        </div>
        <div class="title-bar-right">
          <div class="save-status">
            @if (saving) {
              <mat-icon class="saving">sync</mat-icon>
              <span>Saving...</span>
            } @else if (lastSaved) {
              <mat-icon>cloud_done</mat-icon>
              <span>All changes saved</span>
            }
          </div>
          <div class="active-users">
            @for (user of activeUsers; track user.userId) {
              <div class="user-avatar" 
                   [style.background-color]="user.color"
                   [matTooltip]="user.userName">
                {{ user.userName.charAt(0).toUpperCase() }}
              </div>
            }
          </div>
          <div class="connection-status" [class]="connectionState">
            <mat-icon>{{ getConnectionIcon() }}</mat-icon>
          </div>
        </div>
      </div>

      <!-- Ribbon -->
      <div class="ribbon">
        <div class="ribbon-tabs">
          <button class="ribbon-tab" [class.active]="activeRibbonTab === 'home'" (click)="activeRibbonTab = 'home'">Home</button>
          <button class="ribbon-tab" [class.active]="activeRibbonTab === 'insert'" (click)="activeRibbonTab = 'insert'">Insert</button>
          <button class="ribbon-tab" [class.active]="activeRibbonTab === 'format'" (click)="activeRibbonTab = 'format'">Format</button>
          <button class="ribbon-tab" [class.active]="activeRibbonTab === 'view'" (click)="activeRibbonTab = 'view'">View</button>
        </div>

        <!-- Home Tab -->
        @if (activeRibbonTab === 'home') {
          <div class="ribbon-content">
            <!-- Clipboard Group -->
            <div class="ribbon-group">
              <div class="ribbon-group-content">
                <button class="ribbon-btn large" (click)="paste()" matTooltip="Paste (Ctrl+V)">
                  <mat-icon>content_paste</mat-icon>
                  <span>Paste</span>
                </button>
                <div class="ribbon-btn-stack">
                  <button class="ribbon-btn small" (click)="cut()" matTooltip="Cut (Ctrl+X)">
                    <mat-icon>content_cut</mat-icon>
                    <span>Cut</span>
                  </button>
                  <button class="ribbon-btn small" (click)="copy()" matTooltip="Copy (Ctrl+C)">
                    <mat-icon>content_copy</mat-icon>
                    <span>Copy</span>
                  </button>
                </div>
              </div>
              <div class="ribbon-group-label">Clipboard</div>
            </div>

            <div class="ribbon-separator"></div>

            <!-- Font Group -->
            <div class="ribbon-group">
              <div class="ribbon-group-content font-group">
                <div class="font-row">
                  <button class="ribbon-icon-btn" [class.active]="editor?.isActive('bold')" (click)="toggleBold()" matTooltip="Bold (Ctrl+B)">
                    <mat-icon>format_bold</mat-icon>
                  </button>
                  <button class="ribbon-icon-btn" [class.active]="editor?.isActive('italic')" (click)="toggleItalic()" matTooltip="Italic (Ctrl+I)">
                    <mat-icon>format_italic</mat-icon>
                  </button>
                  <button class="ribbon-icon-btn" [class.active]="editor?.isActive('underline')" (click)="toggleUnderline()" matTooltip="Underline (Ctrl+U)">
                    <mat-icon>format_underlined</mat-icon>
                  </button>
                  <button class="ribbon-icon-btn" [class.active]="editor?.isActive('strike')" (click)="toggleStrike()" matTooltip="Strikethrough">
                    <mat-icon>strikethrough_s</mat-icon>
                  </button>
                  <button class="ribbon-icon-btn" [class.active]="editor?.isActive('highlight')" (click)="toggleHighlight()" matTooltip="Highlight">
                    <mat-icon>highlight</mat-icon>
                  </button>
                </div>
              </div>
              <div class="ribbon-group-label">Font</div>
            </div>

            <div class="ribbon-separator"></div>

            <!-- Paragraph Group -->
            <div class="ribbon-group">
              <div class="ribbon-group-content paragraph-group">
                <div class="paragraph-row">
                  <button class="ribbon-icon-btn" [class.active]="editor?.isActive('bulletList')" (click)="toggleBulletList()" matTooltip="Bullets">
                    <mat-icon>format_list_bulleted</mat-icon>
                  </button>
                  <button class="ribbon-icon-btn" [class.active]="editor?.isActive('orderedList')" (click)="toggleOrderedList()" matTooltip="Numbering">
                    <mat-icon>format_list_numbered</mat-icon>
                  </button>
                  <button class="ribbon-icon-btn" [class.active]="editor?.isActive('taskList')" (click)="toggleTaskList()" matTooltip="Checklist">
                    <mat-icon>checklist</mat-icon>
                  </button>
                  <button class="ribbon-icon-btn" (click)="decreaseIndent()" matTooltip="Decrease Indent">
                    <mat-icon>format_indent_decrease</mat-icon>
                  </button>
                  <button class="ribbon-icon-btn" (click)="increaseIndent()" matTooltip="Increase Indent">
                    <mat-icon>format_indent_increase</mat-icon>
                  </button>
                </div>
                <div class="paragraph-row">
                  <button class="ribbon-icon-btn" [class.active]="editor?.isActive({ textAlign: 'left' })" (click)="setTextAlign('left')" matTooltip="Align Left">
                    <mat-icon>format_align_left</mat-icon>
                  </button>
                  <button class="ribbon-icon-btn" [class.active]="editor?.isActive({ textAlign: 'center' })" (click)="setTextAlign('center')" matTooltip="Center">
                    <mat-icon>format_align_center</mat-icon>
                  </button>
                  <button class="ribbon-icon-btn" [class.active]="editor?.isActive({ textAlign: 'right' })" (click)="setTextAlign('right')" matTooltip="Align Right">
                    <mat-icon>format_align_right</mat-icon>
                  </button>
                  <button class="ribbon-icon-btn" [class.active]="editor?.isActive({ textAlign: 'justify' })" (click)="setTextAlign('justify')" matTooltip="Justify">
                    <mat-icon>format_align_justify</mat-icon>
                  </button>
                </div>
              </div>
              <div class="ribbon-group-label">Paragraph</div>
            </div>

            <div class="ribbon-separator"></div>

            <!-- Styles Group -->
            <div class="ribbon-group">
              <div class="ribbon-group-content styles-group">
                <button class="style-btn" [class.active]="editor?.isActive('paragraph')" (click)="setParagraph()">
                  <span class="style-preview normal">Normal</span>
                </button>
                <button class="style-btn" [class.active]="editor?.isActive('heading', { level: 1 })" (click)="setHeading(1)">
                  <span class="style-preview h1">Heading 1</span>
                </button>
                <button class="style-btn" [class.active]="editor?.isActive('heading', { level: 2 })" (click)="setHeading(2)">
                  <span class="style-preview h2">Heading 2</span>
                </button>
                <button class="style-btn" [class.active]="editor?.isActive('heading', { level: 3 })" (click)="setHeading(3)">
                  <span class="style-preview h3">Heading 3</span>
                </button>
              </div>
              <div class="ribbon-group-label">Styles</div>
            </div>

            <div class="ribbon-separator"></div>

            <!-- Editing Group -->
            <div class="ribbon-group">
              <div class="ribbon-group-content editing-group">
                <button class="ribbon-btn vertical" (click)="undo()" matTooltip="Undo">
                  <mat-icon>undo</mat-icon>
                  <span>Undo</span>
                </button>
                <button class="ribbon-btn vertical" (click)="redo()" matTooltip="Redo">
                  <mat-icon>redo</mat-icon>
                  <span>Redo</span>
                </button>
                <button class="ribbon-btn vertical" (click)="clearFormatting()" matTooltip="Clear Formatting">
                  <mat-icon>format_clear</mat-icon>
                  <span>Clear</span>
                </button>
              </div>
              <div class="ribbon-group-label">Editing</div>
            </div>
          </div>
        }

        <!-- Insert Tab -->
        @if (activeRibbonTab === 'insert') {
          <div class="ribbon-content">
            <!-- Elements Group -->
            <div class="ribbon-group">
              <div class="ribbon-group-content">
                <button class="ribbon-btn vertical" (click)="insertHorizontalRule()" matTooltip="Horizontal Line">
                  <mat-icon>horizontal_rule</mat-icon>
                  <span>Line</span>
                </button>
                <button class="ribbon-btn vertical" [class.active]="editor?.isActive('blockquote')" (click)="toggleBlockquote()" matTooltip="Quote">
                  <mat-icon>format_quote</mat-icon>
                  <span>Quote</span>
                </button>
                <button class="ribbon-btn vertical" [class.active]="editor?.isActive('codeBlock')" (click)="toggleCodeBlock()" matTooltip="Code Block">
                  <mat-icon>code</mat-icon>
                  <span>Code</span>
                </button>
              </div>
              <div class="ribbon-group-label">Elements</div>
            </div>

            <div class="ribbon-separator"></div>

            <!-- Import Group -->
            <div class="ribbon-group">
              <div class="ribbon-group-content">
                <button class="ribbon-btn large" (click)="triggerImportDocx()" matTooltip="Import Word Document">
                  <mat-icon>upload_file</mat-icon>
                  <span>Word Doc</span>
                </button>
                <input type="file" #docxFileInput hidden accept=".docx" (change)="importDocx($event)">
              </div>
              <div class="ribbon-group-label">Import</div>
            </div>
          </div>
        }

        <!-- Format Tab -->
        @if (activeRibbonTab === 'format') {
          <div class="ribbon-content">
            <!-- Text Group -->
            <div class="ribbon-group">
              <div class="ribbon-group-content">
                <button class="ribbon-btn large" (click)="toggleBold()" [class.active]="editor?.isActive('bold')">
                  <mat-icon>format_bold</mat-icon>
                  <span>Bold</span>
                </button>
                <button class="ribbon-btn large" (click)="toggleItalic()" [class.active]="editor?.isActive('italic')">
                  <mat-icon>format_italic</mat-icon>
                  <span>Italic</span>
                </button>
                <button class="ribbon-btn large" (click)="toggleUnderline()" [class.active]="editor?.isActive('underline')">
                  <mat-icon>format_underlined</mat-icon>
                  <span>Underline</span>
                </button>
              </div>
              <div class="ribbon-group-label">Text</div>
            </div>

            <div class="ribbon-separator"></div>

            <!-- Case Group -->
            <div class="ribbon-group">
              <div class="ribbon-group-content">
                <button class="ribbon-btn vertical" (click)="transformText('uppercase')" matTooltip="UPPERCASE">
                  <mat-icon>keyboard_arrow_up</mat-icon>
                  <span>UPPER</span>
                </button>
                <button class="ribbon-btn vertical" (click)="transformText('lowercase')" matTooltip="lowercase">
                  <mat-icon>keyboard_arrow_down</mat-icon>
                  <span>lower</span>
                </button>
                <button class="ribbon-btn vertical" (click)="transformText('capitalize')" matTooltip="Capitalize">
                  <mat-icon>text_fields</mat-icon>
                  <span>Title</span>
                </button>
              </div>
              <div class="ribbon-group-label">Case</div>
            </div>

            <div class="ribbon-separator"></div>

            <!-- Clear Group -->
            <div class="ribbon-group">
              <div class="ribbon-group-content">
                <button class="ribbon-btn large" (click)="clearFormatting()" matTooltip="Remove all formatting">
                  <mat-icon>format_clear</mat-icon>
                  <span>Clear Format</span>
                </button>
              </div>
              <div class="ribbon-group-label">Clear</div>
            </div>
          </div>
        }

        <!-- View Tab -->
        @if (activeRibbonTab === 'view') {
          <div class="ribbon-content">
            <!-- Zoom Group -->
            <div class="ribbon-group">
              <div class="ribbon-group-content zoom-group">
                <button class="ribbon-btn vertical" (click)="zoomIn()" matTooltip="Zoom In">
                  <mat-icon>zoom_in</mat-icon>
                  <span>Zoom In</span>
                </button>
                <div class="zoom-level">{{ zoomLevel }}%</div>
                <button class="ribbon-btn vertical" (click)="zoomOut()" matTooltip="Zoom Out">
                  <mat-icon>zoom_out</mat-icon>
                  <span>Zoom Out</span>
                </button>
                <button class="ribbon-btn vertical" (click)="resetZoom()" matTooltip="Reset Zoom">
                  <mat-icon>fit_screen</mat-icon>
                  <span>100%</span>
                </button>
              </div>
              <div class="ribbon-group-label">Zoom</div>
            </div>

            <div class="ribbon-separator"></div>

            <!-- Window Group -->
            <div class="ribbon-group">
              <div class="ribbon-group-content">
                <button class="ribbon-btn large" (click)="toggleFullscreen()" matTooltip="Toggle Fullscreen">
                  <mat-icon>{{ isFullscreen ? 'fullscreen_exit' : 'fullscreen' }}</mat-icon>
                  <span>Fullscreen</span>
                </button>
              </div>
              <div class="ribbon-group-label">Window</div>
            </div>

            <div class="ribbon-separator"></div>

            <!-- Show Group -->
            <div class="ribbon-group">
              <div class="ribbon-group-content">
                <button class="ribbon-btn vertical" [class.active]="showRuler" (click)="showRuler = !showRuler">
                  <mat-icon>straighten</mat-icon>
                  <span>Ruler</span>
                </button>
                <button class="ribbon-btn vertical" [class.active]="showWordCount" (click)="showWordCount = !showWordCount">
                  <mat-icon>text_snippet</mat-icon>
                  <span>Word Count</span>
                </button>
              </div>
              <div class="ribbon-group-label">Show</div>
            </div>
          </div>
        }
      </div>

      <!-- Loading overlay -->
      @if (loading) {
        <div class="loading-overlay">
          <mat-spinner diameter="48"></mat-spinner>
          <p>Loading document...</p>
        </div>
      }

      <!-- Ruler (optional) -->
      @if (showRuler) {
        <div class="ruler">
          @for (i of rulerMarks; track i) {
            <div class="ruler-mark" [class.major]="i % 10 === 0">
              @if (i % 10 === 0) {
                <span>{{ i / 10 }}</span>
              }
            </div>
          }
        </div>
      }

      <!-- Editor area -->
      <div class="editor-wrapper" [style.zoom]="zoomLevel / 100">
        <div class="editor-page">
          <div #editorElement class="tiptap-editor"></div>
        </div>
      </div>

      <!-- Status Bar -->
      <div class="status-bar">
        <div class="status-left">
          @if (showWordCount) {
            <span>Words: {{ wordCount }}</span>
            <span>Characters: {{ charCount }}</span>
          }
        </div>
        <div class="status-right">
          <span class="zoom-control">
            <button mat-icon-button (click)="zoomOut()" [disabled]="zoomLevel <= 50">
              <mat-icon>remove</mat-icon>
            </button>
            <span>{{ zoomLevel }}%</span>
            <button mat-icon-button (click)="zoomIn()" [disabled]="zoomLevel >= 200">
              <mat-icon>add</mat-icon>
            </button>
          </span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .editor-container {
      display: flex;
      flex-direction: column;
      height: 100vh;
      background: #f1f3f4;
    }

    .editor-container.loading {
      pointer-events: none;
    }

    /* Title Bar */
    .title-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 16px;
      background: #f9fbfd;
      border-bottom: 1px solid #e0e0e0;
    }

    .title-bar-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .document-icon {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .document-icon mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: #4285f4;
    }

    .document-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .title-input {
      border: none;
      font-size: 18px;
      font-weight: 500;
      padding: 4px 8px;
      border-radius: 4px;
      background: transparent;
      min-width: 200px;
    }

    .title-input:hover,
    .title-input:focus {
      background: #e8f0fe;
      outline: none;
    }

    .menu-bar {
      display: flex;
      gap: 0;
    }

    .menu-bar button {
      font-size: 13px;
      min-width: auto;
      padding: 2px 8px;
      height: auto;
      line-height: 1.5;
    }

    .title-bar-right {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .save-status {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #5f6368;
    }

    .save-status mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .save-status .saving {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .active-users {
      display: flex;
      align-items: center;
    }

    .user-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 600;
      font-size: 14px;
      border: 2px solid white;
      margin-left: -8px;
    }

    .user-avatar:first-child {
      margin-left: 0;
    }

    .connection-status {
      display: flex;
      align-items: center;
      padding: 4px;
      border-radius: 50%;
    }

    .connection-status mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .connection-status.Connected {
      color: #34a853;
    }

    .connection-status.Reconnecting {
      color: #fbbc04;
    }

    .connection-status.Disconnected,
    .connection-status.Error {
      color: #ea4335;
    }

    /* Ribbon */
    .ribbon {
      background: #f9fbfd;
      border-bottom: 1px solid #dadce0;
    }

    .ribbon-tabs {
      display: flex;
      padding: 0 16px;
      border-bottom: 1px solid #e0e0e0;
      background: white;
    }

    .ribbon-tab {
      padding: 8px 16px;
      border: none;
      background: none;
      cursor: pointer;
      font-size: 13px;
      color: #5f6368;
      border-bottom: 3px solid transparent;
      transition: all 0.2s;
    }

    .ribbon-tab:hover {
      background: #f1f3f4;
    }

    .ribbon-tab.active {
      color: #1a73e8;
      border-bottom-color: #1a73e8;
    }

    .ribbon-content {
      display: flex;
      align-items: flex-start;
      padding: 8px 16px;
      gap: 4px;
      background: white;
      min-height: 80px;
    }

    .ribbon-group {
      display: flex;
      flex-direction: column;
      padding: 4px 8px;
    }

    .ribbon-group-content {
      display: flex;
      align-items: center;
      gap: 4px;
      flex: 1;
    }

    .ribbon-group-label {
      font-size: 10px;
      color: #5f6368;
      text-align: center;
      padding-top: 4px;
      border-top: 1px solid #e0e0e0;
      margin-top: 4px;
    }

    .ribbon-separator {
      width: 1px;
      background: #dadce0;
      align-self: stretch;
      margin: 0 4px;
    }

    .ribbon-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 6px 10px;
      border: none;
      background: none;
      cursor: pointer;
      border-radius: 4px;
      color: #5f6368;
      transition: all 0.15s;
      gap: 2px;
    }

    .ribbon-btn:hover {
      background: #e8f0fe;
      color: #1a73e8;
    }

    .ribbon-btn.active {
      background: #d2e3fc;
      color: #1a73e8;
    }

    .ribbon-btn mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .ribbon-btn span {
      font-size: 11px;
      white-space: nowrap;
    }

    .ribbon-btn.large {
      padding: 8px 16px;
    }

    .ribbon-btn.large mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .ribbon-btn.vertical {
      flex-direction: column;
    }

    .ribbon-btn.small {
      padding: 4px 8px;
      flex-direction: row;
      gap: 4px;
    }

    .ribbon-btn.small mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .ribbon-btn-stack {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    /* Font Group */
    .font-group {
      flex-direction: column;
      gap: 4px;
    }

    .font-row {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .font-select {
      width: 120px;
      padding: 4px 8px;
      border: 1px solid #dadce0;
      border-radius: 4px;
      font-size: 12px;
      background: white;
    }

    .font-size-select {
      width: 50px;
      padding: 4px;
      border: 1px solid #dadce0;
      border-radius: 4px;
      font-size: 12px;
      background: white;
    }

    .ribbon-icon-btn {
      width: 28px;
      height: 28px;
      padding: 2px;
      border: none;
      background: none;
      cursor: pointer;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #5f6368;
      position: relative;
    }

    .ribbon-icon-btn:hover {
      background: #e8f0fe;
      color: #1a73e8;
    }

    .ribbon-icon-btn.active {
      background: #d2e3fc;
      color: #1a73e8;
    }

    .ribbon-icon-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .color-btn-wrapper {
      position: relative;
    }

    .color-indicator {
      position: absolute;
      bottom: 2px;
      left: 4px;
      right: 4px;
      height: 3px;
      border-radius: 1px;
    }

    /* Paragraph Group */
    .paragraph-group {
      flex-direction: column;
      gap: 4px;
    }

    .paragraph-row {
      display: flex;
      gap: 2px;
    }

    /* Styles Group */
    .styles-group {
      gap: 4px;
    }

    .style-btn {
      padding: 4px 8px;
      border: 1px solid #dadce0;
      background: white;
      cursor: pointer;
      border-radius: 4px;
      min-width: 70px;
      text-align: left;
    }

    .style-btn:hover {
      border-color: #1a73e8;
    }

    .style-btn.active {
      border-color: #1a73e8;
      background: #e8f0fe;
    }

    .style-preview {
      display: block;
      line-height: 1.2;
    }

    .style-preview.normal {
      font-size: 11px;
    }

    .style-preview.h1 {
      font-size: 14px;
      font-weight: 700;
      color: #202124;
    }

    .style-preview.h2 {
      font-size: 12px;
      font-weight: 600;
      color: #202124;
    }

    .style-preview.h3 {
      font-size: 11px;
      font-weight: 600;
      color: #5f6368;
    }

    /* Editing Group */
    .editing-group {
      gap: 4px;
    }

    /* Zoom Group */
    .zoom-group {
      align-items: center;
      gap: 8px;
    }

    .zoom-level {
      font-size: 12px;
      color: #5f6368;
      min-width: 40px;
      text-align: center;
    }

    /* Table Grid */
    .table-grid {
      padding: 8px;
    }

    .table-size-label {
      font-size: 12px;
      color: #5f6368;
      margin-bottom: 8px;
      text-align: center;
    }

    .table-grid-cells {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .table-grid-row {
      display: flex;
      gap: 2px;
    }

    .table-grid-cell {
      width: 20px;
      height: 20px;
      border: 1px solid #dadce0;
      background: white;
      cursor: pointer;
    }

    .table-grid-cell.selected {
      background: #d2e3fc;
      border-color: #1a73e8;
    }

    /* Color Grid */
    .color-grid {
      display: grid;
      grid-template-columns: repeat(8, 1fr);
      gap: 4px;
      padding: 8px;
    }

    .color-swatch {
      width: 24px;
      height: 24px;
      border: 1px solid #dadce0;
      border-radius: 4px;
      cursor: pointer;
    }

    .color-swatch:hover {
      transform: scale(1.1);
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }

    /* Ruler */
    .ruler {
      display: flex;
      background: white;
      border-bottom: 1px solid #dadce0;
      padding: 4px 0;
      justify-content: center;
    }

    .ruler-mark {
      width: 8px;
      height: 8px;
      border-left: 1px solid #dadce0;
      font-size: 8px;
      color: #5f6368;
    }

    .ruler-mark.major {
      height: 16px;
      border-left-color: #5f6368;
    }

    .ruler-mark span {
      position: relative;
      top: -2px;
      left: 2px;
    }

    /* Loading Overlay */
    .loading-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.9);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }

    .loading-overlay p {
      margin-top: 16px;
      color: #5f6368;
    }

    /* Editor Wrapper */
    .editor-wrapper {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
      display: flex;
      justify-content: center;
      background: #f1f3f4;
    }

    .editor-page {
      width: 100%;
      max-width: 816px;
      min-height: calc(100vh - 280px);
      background: white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);
      border-radius: 0;
      padding: 96px 96px 96px 96px;
    }

    .tiptap-editor {
      outline: none;
      min-height: 100%;
    }

    /* Status Bar */
    .status-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 16px;
      background: #f9fbfd;
      border-top: 1px solid #dadce0;
      font-size: 12px;
      color: #5f6368;
    }

    .status-left {
      display: flex;
      gap: 16px;
    }

    .status-right {
      display: flex;
      align-items: center;
    }

    .zoom-control {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .zoom-control button {
      width: 24px;
      height: 24px;
      min-width: 24px;
      padding: 0;
    }

    .zoom-control mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    /* Tiptap editor styles */
    :host ::ng-deep .tiptap-editor {
      font-family: 'Arial', sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #000;
    }

    :host ::ng-deep .tiptap-editor p {
      margin: 0 0 12px 0;
    }

    :host ::ng-deep .tiptap-editor h1 {
      font-size: 24pt;
      font-weight: 700;
      margin: 24px 0 12px 0;
    }

    :host ::ng-deep .tiptap-editor h2 {
      font-size: 18pt;
      font-weight: 600;
      margin: 20px 0 10px 0;
    }

    :host ::ng-deep .tiptap-editor h3 {
      font-size: 14pt;
      font-weight: 600;
      margin: 16px 0 8px 0;
    }

    :host ::ng-deep .tiptap-editor ul,
    :host ::ng-deep .tiptap-editor ol {
      padding-left: 24px;
      margin: 0 0 12px 0;
    }

    :host ::ng-deep .tiptap-editor li {
      margin: 4px 0;
    }

    :host ::ng-deep .tiptap-editor blockquote {
      border-left: 4px solid #1a73e8;
      margin: 16px 0;
      padding: 8px 16px;
      background: #f8f9fa;
      font-style: italic;
    }

    :host ::ng-deep .tiptap-editor pre {
      background: #f5f5f5;
      color: #333;
      padding: 16px;
      border-radius: 4px;
      overflow-x: auto;
      margin: 16px 0;
      font-family: 'Courier New', monospace;
    }

    :host ::ng-deep .tiptap-editor code {
      background: #f5f5f5;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
    }

    :host ::ng-deep .tiptap-editor pre code {
      background: none;
      padding: 0;
    }

    :host ::ng-deep .tiptap-editor hr {
      border: none;
      border-top: 1px solid #dadce0;
      margin: 24px 0;
    }

    :host ::ng-deep .tiptap-editor mark {
      background: #fff176;
      padding: 0;
    }

    :host ::ng-deep .tiptap-editor table {
      border-collapse: collapse;
      width: 100%;
      margin: 16px 0;
    }

    :host ::ng-deep .tiptap-editor th,
    :host ::ng-deep .tiptap-editor td {
      border: 1px solid #dadce0;
      padding: 8px 12px;
      text-align: left;
    }

    :host ::ng-deep .tiptap-editor th {
      background: #f5f5f5;
      font-weight: 600;
    }

    :host ::ng-deep .tiptap-editor img {
      max-width: 100%;
      height: auto;
    }

    :host ::ng-deep .tiptap-editor a {
      color: #1a73e8;
      text-decoration: underline;
    }

    :host ::ng-deep .tiptap-editor ul[data-type="taskList"] {
      list-style: none;
      padding-left: 0;
    }

    :host ::ng-deep .tiptap-editor ul[data-type="taskList"] li {
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }

    :host ::ng-deep .tiptap-editor ul[data-type="taskList"] input[type="checkbox"] {
      margin-top: 4px;
    }

    /* Placeholder */
    :host ::ng-deep .tiptap-editor p.is-editor-empty:first-child::before {
      content: attr(data-placeholder);
      color: #9aa0a6;
      pointer-events: none;
      float: left;
      height: 0;
    }

    /* Collaboration cursor */
    :host ::ng-deep .collaboration-cursor__caret {
      border-left: 2px solid;
      margin-left: -1px;
      margin-right: -1px;
      pointer-events: none;
      position: relative;
      word-break: normal;
    }

    :host ::ng-deep .collaboration-cursor__label {
      border-radius: 4px;
      color: white;
      font-size: 12px;
      font-weight: 600;
      left: -1px;
      line-height: 1;
      padding: 2px 6px;
      position: absolute;
      top: -20px;
      user-select: none;
      white-space: nowrap;
    }

    @media (max-width: 768px) {
      .ribbon-content {
        flex-wrap: wrap;
        min-height: auto;
      }

      .ribbon-group {
        padding: 4px;
      }

      .editor-page {
        padding: 48px;
      }

      .title-bar {
        flex-direction: column;
        gap: 8px;
      }

      .title-bar-left,
      .title-bar-right {
        width: 100%;
      }
    }
  `]
})
export class DocEditorComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('editorElement') editorElement!: ElementRef;
  @ViewChild('docxFileInput') docxFileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('imageInput') imageInput!: ElementRef<HTMLInputElement>;

  documentId!: number;
  document: DocumentDetail | null = null;
  documentTitle = '';
  loading = true;
  saving = false;
  lastSaved: Date | null = null;

  editor: Editor | null = null;
  ydoc: Y.Doc | null = null;

  activeUsers: UserPresence[] = [];
  connectionState = 'Disconnected';

  // Ribbon state
  activeRibbonTab = 'home';

  // Font settings
  selectedFont = 'Arial';
  selectedFontSize = '11';

  // Color settings
  selectedTextColor = '#000000';
  selectedHighlightColor = '#ffff00';
  textColors = [
    '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef',
    '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff',
    '#9900ff', '#ff00ff', '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3',
    '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc', '#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599'
  ];
  highlightColors = [
    '#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#ff0000', '#0000ff', '#ff9900', '#9900ff'
  ];

  // Table grid
  tableRows = 2;
  tableCols = 2;

  // View settings
  zoomLevel = 100;
  isFullscreen = false;
  showRuler = false;
  showWordCount = true;
  wordCount = 0;
  charCount = 0;
  rulerMarks = Array.from({ length: 81 }, (_, i) => i);

  private subscriptions: Subscription[] = [];
  private autosaveSubject = new Subject<void>();
  private currentUserName = '';
  private currentUserColor = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private docsService: CollaborativeDocsService,
    private authService: AuthService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.documentId = Number(this.route.snapshot.paramMap.get('id'));

    // Get current user info
    const user = this.authService.currentUserValue;
    this.currentUserName = user?.name || user?.email || 'Unknown';
    this.currentUserColor = this.getRandomColor();

    // Setup autosave with debounce
    this.subscriptions.push(
      this.autosaveSubject.pipe(debounceTime(2000)).subscribe(() => {
        this.saveSnapshot();
      })
    );

    // Subscribe to connection state
    this.subscriptions.push(
      this.docsService.connectionState$.subscribe(state => {
        this.connectionState = state;
      })
    );

    // Load document
    this.loadDocument();
  }

  ngAfterViewInit(): void {
    // Editor will be initialized after document loads
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());

    // Leave document room
    if (this.documentId) {
      this.docsService.leaveDocument(this.documentId).catch(console.error);
    }

    // Destroy editor
    if (this.editor) {
      this.editor.destroy();
    }

    // Destroy Yjs doc
    if (this.ydoc) {
      this.ydoc.destroy();
    }
  }

  private loadDocument(): void {
    this.docsService.getDocument(this.documentId).subscribe({
      next: (doc) => {
        this.document = doc;
        this.documentTitle = doc.title;
        this.initializeEditor(doc.yjsState);
        this.setupRealTimeSync();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading document:', err);
        this.snackBar.open('Failed to load document', 'Close', { duration: 3000 });
        this.router.navigate(['/docs']);
      }
    });
  }

  private initializeEditor(initialState?: string): void {
    // Create Yjs document
    this.ydoc = new Y.Doc();

    // Load initial state if exists
    if (initialState) {
      try {
        const state = Uint8Array.from(atob(initialState), c => c.charCodeAt(0));
        Y.applyUpdate(this.ydoc, state);
      } catch (e) {
        console.error('Error loading initial state:', e);
      }
    }

    // Create editor with Tiptap
    this.editor = new Editor({
      element: this.editorElement.nativeElement,
      extensions: [
        StarterKit.configure({
          history: false, // Yjs handles history
        }),
        Placeholder.configure({
          placeholder: 'Start typing your document...',
        }),
        Underline,
        TextAlign.configure({
          types: ['heading', 'paragraph'],
        }),
        Highlight.configure({
          multicolor: true,
        }),
        TaskList,
        TaskItem.configure({
          nested: true,
        }),
        Collaboration.configure({
          document: this.ydoc,
        }),
      ],
      editorProps: {
        attributes: {
          class: 'tiptap-editor',
        },
      },
      onUpdate: ({ editor }) => {
        this.autosaveSubject.next();
        this.updateWordCount();
      },
      onSelectionUpdate: ({ editor }) => {
        const { from, to } = editor.state.selection;
        this.docsService.updateCursor(this.documentId, from, to).catch(console.error);
      },
    });

    // Listen for Yjs updates to broadcast
    this.ydoc.on('update', (update: Uint8Array, origin: any) => {
      if (origin !== 'remote') {
        const base64Update = btoa(String.fromCharCode(...update));
        this.docsService.broadcastUpdate(this.documentId, base64Update).catch(console.error);
      }
    });

    // Initial word count
    this.updateWordCount();
  }

  private async setupRealTimeSync(): Promise<void> {
    const token = this.authService.getToken();
    if (!token) return;

    try {
      await this.docsService.startConnection(token);
      await this.docsService.joinDocument(this.documentId);

      // Handle document updates from other users
      this.subscriptions.push(
        this.docsService.documentUpdate$.subscribe(update => {
          if (this.ydoc) {
            try {
              const updateArray = Uint8Array.from(atob(update), c => c.charCodeAt(0));
              Y.applyUpdate(this.ydoc, updateArray, 'remote');
            } catch (e) {
              console.error('Error applying update:', e);
            }
          }
        })
      );

      // Handle presence
      this.subscriptions.push(
        this.docsService.presenceSync$.subscribe(users => {
          this.activeUsers = users;
        })
      );

      this.subscriptions.push(
        this.docsService.userJoined$.subscribe(({ connectionId, presence }) => {
          if (!this.activeUsers.find(u => u.userId === presence.userId)) {
            this.activeUsers = [...this.activeUsers, presence];
          }
        })
      );

      this.subscriptions.push(
        this.docsService.userLeft$.subscribe(connectionId => {
          // We'd need to track connectionId to userId mapping for proper removal
          // For now, we'll rely on presence sync
        })
      );

      // Handle sync requests (for reconnection)
      this.subscriptions.push(
        this.docsService.syncRequested$.subscribe(async (connectionId) => {
          if (this.ydoc) {
            const state = Y.encodeStateAsUpdate(this.ydoc);
            const base64State = btoa(String.fromCharCode(...state));
            await this.docsService.sendSyncData(connectionId, base64State);
          }
        })
      );

      this.subscriptions.push(
        this.docsService.syncData$.subscribe(yjsState => {
          if (this.ydoc) {
            try {
              const state = Uint8Array.from(atob(yjsState), c => c.charCodeAt(0));
              Y.applyUpdate(this.ydoc, state, 'remote');
            } catch (e) {
              console.error('Error applying sync data:', e);
            }
          }
        })
      );

    } catch (error) {
      console.error('Error setting up real-time sync:', error);
    }
  }

  private async saveSnapshot(): Promise<void> {
    if (!this.ydoc || this.saving) return;

    this.saving = true;

    try {
      const state = Y.encodeStateAsUpdate(this.ydoc);
      const base64State = btoa(String.fromCharCode(...state));

      await this.docsService.saveSnapshot(this.documentId, {
        documentId: this.documentId,
        yjsState: base64State
      }).toPromise();

      this.lastSaved = new Date();
    } catch (error) {
      console.error('Error saving snapshot:', error);
    } finally {
      this.saving = false;
    }
  }

  saveTitle(): void {
    if (this.document && this.documentTitle !== this.document.title) {
      this.docsService.updateDocument(this.documentId, { title: this.documentTitle }).subscribe({
        next: () => {
          if (this.document) {
            this.document.title = this.documentTitle;
          }
        },
        error: (err) => {
          console.error('Error saving title:', err);
        }
      });
    }
  }

  private getRandomColor(): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  getConnectionIcon(): string {
    switch (this.connectionState) {
      case 'Connected': return 'cloud_done';
      case 'Reconnecting': return 'sync';
      case 'Disconnected': return 'cloud_off';
      case 'Error': return 'error';
      default: return 'cloud_off';
    }
  }

  // Editor commands
  toggleBold(): void {
    this.editor?.chain().focus().toggleBold().run();
  }

  toggleItalic(): void {
    this.editor?.chain().focus().toggleItalic().run();
  }

  toggleUnderline(): void {
    this.editor?.chain().focus().toggleUnderline().run();
  }

  toggleStrike(): void {
    this.editor?.chain().focus().toggleStrike().run();
  }

  setHeading(level: 1 | 2 | 3): void {
    this.editor?.chain().focus().toggleHeading({ level }).run();
  }

  setParagraph(): void {
    this.editor?.chain().focus().setParagraph().run();
  }

  toggleBulletList(): void {
    this.editor?.chain().focus().toggleBulletList().run();
  }

  toggleOrderedList(): void {
    this.editor?.chain().focus().toggleOrderedList().run();
  }

  toggleTaskList(): void {
    this.editor?.chain().focus().toggleTaskList().run();
  }

  setTextAlign(align: 'left' | 'center' | 'right' | 'justify'): void {
    this.editor?.chain().focus().setTextAlign(align).run();
  }

  toggleBlockquote(): void {
    this.editor?.chain().focus().toggleBlockquote().run();
  }

  toggleCodeBlock(): void {
    this.editor?.chain().focus().toggleCodeBlock().run();
  }

  insertHorizontalRule(): void {
    this.editor?.chain().focus().setHorizontalRule().run();
  }

  undo(): void {
    this.editor?.chain().focus().undo().run();
  }

  redo(): void {
    this.editor?.chain().focus().redo().run();
  }

  // New ribbon methods (some unavailable without additional extensions)
  toggleSubscript(): void {
    // Subscript extension not available in Tiptap v2.x
    this.snackBar.open('Subscript not available', 'Close', { duration: 2000 });
  }

  toggleSuperscript(): void {
    // Superscript extension not available in Tiptap v2.x
    this.snackBar.open('Superscript not available', 'Close', { duration: 2000 });
  }

  setFont(): void {
    // FontFamily extension not available in Tiptap v2.x
    this.snackBar.open('Font selection not available', 'Close', { duration: 2000 });
  }

  setFontSize(): void {
    // Font size not available without TextStyle extension
    this.snackBar.open('Font size not available', 'Close', { duration: 2000 });
  }

  setTextColor(color: string): void {
    // Color extension not available in Tiptap v2.x
    this.selectedTextColor = color;
    this.snackBar.open('Text color not available', 'Close', { duration: 2000 });
  }

  setHighlightColor(color: string): void {
    this.selectedHighlightColor = color;
    this.editor?.chain().focus().toggleHighlight({ color }).run();
  }

  toggleHighlight(): void {
    this.editor?.chain().focus().toggleHighlight({ color: this.selectedHighlightColor }).run();
  }

  clearFormatting(): void {
    this.editor?.chain().focus().clearNodes().unsetAllMarks().run();
  }

  decreaseIndent(): void {
    this.editor?.chain().focus().liftListItem('listItem').run();
  }

  increaseIndent(): void {
    this.editor?.chain().focus().sinkListItem('listItem').run();
  }

  // Clipboard operations
  cut(): void {
    document.execCommand('cut');
  }

  copy(): void {
    document.execCommand('copy');
  }

  paste(): void {
    navigator.clipboard.readText().then(text => {
      this.editor?.chain().focus().insertContent(text).run();
    }).catch(() => {
      this.snackBar.open('Unable to paste. Please use Ctrl+V', 'Close', { duration: 2000 });
    });
  }

  selectAll(): void {
    this.editor?.chain().focus().selectAll().run();
  }

  // Table operations (not available without Table extension)
  insertTable(): void {
    this.snackBar.open('Tables not available', 'Close', { duration: 2000 });
  }

  // Image operations (not available without Image extension)
  triggerImageUpload(): void {
    this.snackBar.open('Image upload not available', 'Close', { duration: 2000 });
  }

  insertImage(event: Event): void {
    this.snackBar.open('Image insert not available', 'Close', { duration: 2000 });
  }

  // Link operations (not available without Link extension)
  insertLink(): void {
    this.snackBar.open('Link insert not available', 'Close', { duration: 2000 });
  }

  // Text transformation
  transformText(type: 'uppercase' | 'lowercase' | 'capitalize'): void {
    const { from, to } = this.editor?.state.selection || { from: 0, to: 0 };
    const text = this.editor?.state.doc.textBetween(from, to) || '';
    let transformed = text;
    
    switch (type) {
      case 'uppercase':
        transformed = text.toUpperCase();
        break;
      case 'lowercase':
        transformed = text.toLowerCase();
        break;
      case 'capitalize':
        transformed = text.split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
        break;
    }
    
    this.editor?.chain().focus().insertContentAt({ from, to }, transformed).run();
  }

  // Zoom operations
  zoomIn(): void {
    if (this.zoomLevel < 200) {
      this.zoomLevel += 10;
    }
  }

  zoomOut(): void {
    if (this.zoomLevel > 50) {
      this.zoomLevel -= 10;
    }
  }

  resetZoom(): void {
    this.zoomLevel = 100;
  }

  // Fullscreen
  toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      this.isFullscreen = true;
    } else {
      document.exitFullscreen();
      this.isFullscreen = false;
    }
  }

  // Word count
  private updateWordCount(): void {
    if (this.editor) {
      const text = this.editor.getText();
      this.charCount = text.length;
      this.wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
    }
  }

  // Export
  exportAsHtml(): void {
    if (this.editor) {
      const html = this.editor.getHTML();
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (this.documentTitle || 'document') + '.html';
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  // Print
  print(): void {
    window.print();
  }

  // Word document import
  triggerImportDocx(): void {
    this.docxFileInput.nativeElement.click();
  }

  async importDocx(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (!file) {
      return;
    }

    // Check file type
    if (!file.name.toLowerCase().endsWith('.docx')) {
      this.snackBar.open('Please select a valid Word document (.docx)', 'Close', { duration: 3000 });
      return;
    }

    this.saving = true;
    this.snackBar.open('Importing Word document...', undefined, { duration: 2000 });

    try {
      const arrayBuffer = await file.arrayBuffer();
      
      // Convert DOCX to HTML using mammoth
      const result = await mammoth.convertToHtml({ arrayBuffer });
      
      if (result.messages.length > 0) {
        console.log('Mammoth conversion messages:', result.messages);
      }

      // Insert the HTML content into the editor
      if (this.editor && result.value) {
        // Option 1: Replace all content
        this.editor.chain().focus().setContent(result.value).run();
        
        this.snackBar.open('Word document imported successfully!', 'Close', { duration: 3000 });
        
        // Trigger autosave
        this.autosaveSubject.next();
      }
    } catch (error) {
      console.error('Error importing Word document:', error);
      this.snackBar.open('Failed to import Word document', 'Close', { duration: 3000 });
    } finally {
      this.saving = false;
      // Reset file input so the same file can be selected again
      input.value = '';
    }
  }
}
