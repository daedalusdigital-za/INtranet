import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
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
import { environment } from '../../../../environments/environment';

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
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import { Awareness } from 'y-protocols/awareness';

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
                <button mat-menu-item (click)="triggerImportPdf()">
                  <mat-icon>picture_as_pdf</mat-icon>
                  <span>Import PDF</span>
                </button>
                <button mat-menu-item (click)="triggerScanImport()">
                  <mat-icon>document_scanner</mat-icon>
                  <span>Import Scanned Document</span>
                </button>
                <button mat-menu-item (click)="exportAsHtml()">
                  <mat-icon>download</mat-icon>
                  <span>Export as HTML</span>
                </button>
                <mat-divider></mat-divider>
                <button mat-menu-item (click)="openEmailDialog()">
                  <mat-icon>email</mat-icon>
                  <span>Email Document</span>
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
                <button class="ribbon-btn large" (click)="triggerImportPdf()" matTooltip="Import PDF Document">
                  <mat-icon>picture_as_pdf</mat-icon>
                  <span>PDF</span>
                </button>
                <input type="file" #pdfFileInput hidden accept=".pdf" (change)="importPdf($event)">
                <button class="ribbon-btn large" (click)="triggerScanImport()" matTooltip="Import Scanned Document (OCR)">
                  <mat-icon>document_scanner</mat-icon>
                  <span>Scan</span>
                </button>
                <input type="file" #scanFileInput hidden accept=".png,.jpg,.jpeg,.bmp,.tiff,.tif,.webp,.pdf" (change)="importScanned($event)">
              </div>
              <div class="ribbon-group-label">Import</div>
            </div>

            <div class="ribbon-separator"></div>

            <!-- Share Group -->
            <div class="ribbon-group">
              <div class="ribbon-group-content">
                <button class="ribbon-btn large email-btn" (click)="openEmailDialog()" matTooltip="Email this document">
                  <mat-icon>email</mat-icon>
                  <span>Email</span>
                </button>
              </div>
              <div class="ribbon-group-label">Share</div>
            </div>

            <div class="ribbon-separator"></div>

            <!-- AI Assist Group -->
            <div class="ribbon-group welly-group">
              <div class="ribbon-group-content">
                <button class="ribbon-btn large welly-btn" [matMenuTriggerFor]="wellyMenu" matTooltip="Ask Welly AI">
                  <mat-icon class="welly-icon">auto_awesome</mat-icon>
                  <span>Ask Welly</span>
                </button>
                <mat-menu #wellyMenu="matMenu" class="welly-menu">
                  <button mat-menu-item (click)="wellyAssist('grammar')">
                    <mat-icon>spellcheck</mat-icon>
                    <span>Fix Grammar & Spelling</span>
                  </button>
                  <button mat-menu-item (click)="wellyAssist('summarize')">
                    <mat-icon>summarize</mat-icon>
                    <span>Summarize</span>
                  </button>
                  <button mat-menu-item (click)="wellyAssist('rewrite')">
                    <mat-icon>edit_note</mat-icon>
                    <span>Rewrite Professionally</span>
                  </button>
                  <button mat-menu-item (click)="wellyAssist('improve')">
                    <mat-icon>trending_up</mat-icon>
                    <span>Improve Writing</span>
                  </button>
                  <mat-divider></mat-divider>
                  <button mat-menu-item [matMenuTriggerFor]="translateMenu">
                    <mat-icon>translate</mat-icon>
                    <span>Translate</span>
                  </button>
                  <mat-divider></mat-divider>
                  <button mat-menu-item (click)="wellyAssist('generate')">
                    <mat-icon>auto_fix_high</mat-icon>
                    <span>Generate Content</span>
                  </button>
                </mat-menu>
                <mat-menu #translateMenu="matMenu">
                  <button mat-menu-item (click)="wellyAssist('translate', 'Afrikaans')">Afrikaans</button>
                  <button mat-menu-item (click)="wellyAssist('translate', 'Zulu')">Zulu</button>
                  <button mat-menu-item (click)="wellyAssist('translate', 'Xhosa')">Xhosa</button>
                  <button mat-menu-item (click)="wellyAssist('translate', 'Sotho')">Sotho</button>
                  <button mat-menu-item (click)="wellyAssist('translate', 'Tswana')">Tswana</button>
                  <button mat-menu-item (click)="wellyAssist('translate', 'French')">French</button>
                  <button mat-menu-item (click)="wellyAssist('translate', 'Portuguese')">Portuguese</button>
                </mat-menu>
              </div>
              <div class="ribbon-group-label">AI Assist</div>
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

      <!-- OCR Scanning overlay -->
      @if (ocrScanning) {
        <div class="loading-overlay ocr-overlay">
          <mat-icon class="ocr-scan-icon">document_scanner</mat-icon>
          <mat-spinner diameter="48"></mat-spinner>
          <p class="ocr-status">{{ ocrStatusMessage }}</p>
          @if (ocrProgress > 0) {
            <div class="ocr-progress-bar">
              <div class="ocr-progress-fill" [style.width.%]="ocrProgress"></div>
            </div>
            <span class="ocr-progress-text">{{ ocrProgress }}%</span>
          }
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

      <!-- Welly AI Panel -->
      @if (showWellyPanel) {
        <div class="welly-panel-overlay" (click)="showWellyPanel = false">
          <div class="welly-panel" (click)="$event.stopPropagation()">
            <div class="welly-panel-header">
              <div class="welly-panel-title">
                <mat-icon class="welly-sparkle">auto_awesome</mat-icon>
                <h3>Welly AI Assistant</h3>
              </div>
              <button mat-icon-button (click)="showWellyPanel = false">
                <mat-icon>close</mat-icon>
              </button>
            </div>
            <div class="welly-panel-body">
              @if (wellyLoading) {
                <div class="welly-loading">
                  <mat-spinner diameter="36"></mat-spinner>
                  <p>Welly is {{ wellyActionLabel }}...</p>
                </div>
              } @else if (wellyResult) {
                <div class="welly-result">
                  <div class="welly-result-text">{{ wellyResult }}</div>
                  <div class="welly-result-actions">
                    @if (wellyLastAction === 'grammar' || wellyLastAction === 'rewrite' || wellyLastAction === 'improve' || wellyLastAction === 'translate') {
                      <button mat-raised-button color="primary" (click)="applyWellyResult()">
                        <mat-icon>check</mat-icon> Apply to Document
                      </button>
                    }
                    @if (wellyLastAction === 'generate') {
                      <button mat-raised-button color="primary" (click)="insertWellyResult()">
                        <mat-icon>add</mat-icon> Insert at Cursor
                      </button>
                    }
                    <button mat-button (click)="copyWellyResult()">
                      <mat-icon>content_copy</mat-icon> Copy
                    </button>
                  </div>
                </div>
              } @else if (wellyLastAction === 'generate') {
                <div class="welly-generate-form">
                  <p>Describe what you'd like Welly to write:</p>
                  <textarea [(ngModel)]="wellyGeneratePrompt" placeholder="e.g., Write a professional email about the upcoming team meeting..." rows="4"></textarea>
                  <button mat-raised-button color="primary" (click)="submitWellyGenerate()" [disabled]="!wellyGeneratePrompt.trim()">
                    <mat-icon>auto_fix_high</mat-icon> Generate
                  </button>
                </div>
              }
            </div>
          </div>
        </div>
      }

      <!-- Email Document Dialog -->
      @if (showEmailDialog) {
        <div class="welly-panel-overlay" (click)="showEmailDialog = false">
          <div class="email-dialog" (click)="$event.stopPropagation()">
            <div class="email-dialog-header">
              <div class="email-dialog-title">
                <mat-icon>email</mat-icon>
                <h3>Email Document</h3>
              </div>
              <button mat-icon-button (click)="showEmailDialog = false">
                <mat-icon>close</mat-icon>
              </button>
            </div>
            <div class="email-dialog-body">
              <div class="email-field">
                <label>To <span class="required">*</span></label>
                <input type="text" [(ngModel)]="emailTo" placeholder="email@example.com, another@example.com" class="email-input">
              </div>
              <div class="email-field">
                <label>CC</label>
                <input type="text" [(ngModel)]="emailCc" placeholder="cc@example.com (optional)" class="email-input">
              </div>
              <div class="email-field">
                <label>Subject</label>
                <input type="text" [(ngModel)]="emailSubject" class="email-input">
              </div>
              <div class="email-field">
                <label>Message</label>
                <div class="email-textarea-wrapper">
                  <textarea [(ngModel)]="emailBody" placeholder="Add a message to go with the document..." rows="5" class="email-textarea"></textarea>
                  <button class="welly-compose-btn" (click)="wellyComposeEmail()" [disabled]="emailComposing" matTooltip="Let Welly help compose your message">
                    @if (emailComposing) {
                      <mat-spinner diameter="16"></mat-spinner>
                    } @else {
                      <mat-icon class="welly-sparkle">auto_awesome</mat-icon>
                    }
                    <span>{{ emailComposing ? 'Composing...' : 'Welly Compose' }}</span>
                  </button>
                </div>
              </div>
              <div class="email-options">
                <label class="email-checkbox">
                  <input type="checkbox" [(ngModel)]="emailAttachDoc">
                  <mat-icon>attach_file</mat-icon>
                  <span>Attach document as HTML file</span>
                </label>
                <label class="email-checkbox">
                  <input type="checkbox" [(ngModel)]="emailIncludeInBody">
                  <mat-icon>article</mat-icon>
                  <span>Include document content in email body</span>
                </label>
              </div>
            </div>
            <div class="email-dialog-footer">
              <button mat-button (click)="showEmailDialog = false">Cancel</button>
              <button mat-raised-button color="primary" (click)="sendEmail()" [disabled]="emailSending || !emailTo.trim()">
                @if (emailSending) {
                  <mat-spinner diameter="18" class="btn-spinner"></mat-spinner>
                  <span>Sending...</span>
                } @else {
                  <mat-icon>send</mat-icon>
                  <span>Send Email</span>
                }
              </button>
            </div>
          </div>
        </div>
      }

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

    .ocr-overlay {
      background: rgba(255, 255, 255, 0.95) !important;
      gap: 8px;
    }

    .ocr-scan-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #667eea;
      animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.7; transform: scale(1.05); }
    }

    .ocr-status {
      font-size: 14px;
      color: #333;
      font-weight: 500;
      margin: 4px 0 !important;
    }

    .ocr-progress-bar {
      width: 250px;
      height: 6px;
      background: #e0e0e0;
      border-radius: 3px;
      overflow: hidden;
    }

    .ocr-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #667eea, #764ba2);
      border-radius: 3px;
      transition: width 0.3s ease;
    }

    .ocr-progress-text {
      font-size: 12px;
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
      overflow-wrap: break-word;
      word-break: break-word;
      overflow-x: hidden;
      box-sizing: border-box;
    }

    .tiptap-editor {
      outline: none;
      min-height: 100%;
      overflow-wrap: break-word;
      word-break: break-word;
      white-space: pre-wrap;
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
      overflow-wrap: break-word;
      word-break: break-word;
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
      max-width: 100%;
      white-space: pre-wrap;
      word-break: break-word;
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
      table-layout: fixed;
      overflow-wrap: break-word;
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

    /* Welly AI Assist Styles */
    .welly-group .welly-btn {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 8px;
      transition: all 0.3s ease;
    }

    .welly-group .welly-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .welly-group .welly-icon {
      color: #ffd700;
    }

    .welly-panel-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .welly-panel {
      background: white;
      border-radius: 16px;
      width: 560px;
      max-width: 90vw;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      overflow: hidden;
    }

    .welly-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .welly-panel-title {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .welly-panel-title h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }

    .welly-sparkle {
      color: #ffd700;
    }

    .welly-panel-header button {
      color: white;
    }

    .welly-panel-body {
      padding: 24px;
      overflow-y: auto;
      max-height: 60vh;
    }

    .welly-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 32px;
    }

    .welly-loading p {
      color: #666;
      font-size: 14px;
    }

    .welly-result-text {
      background: #f8f9fa;
      border: 1px solid #e0e0e0;
      border-radius: 10px;
      padding: 16px;
      font-size: 14px;
      line-height: 1.6;
      white-space: pre-wrap;
      max-height: 40vh;
      overflow-y: auto;
      margin-bottom: 16px;
    }

    .welly-result-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .welly-generate-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .welly-generate-form p {
      margin: 0;
      color: #555;
      font-size: 14px;
    }

    .welly-generate-form textarea {
      width: 100%;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 12px;
      font-size: 14px;
      font-family: inherit;
      resize: vertical;
      outline: none;
      transition: border-color 0.2s;
    }

    .welly-generate-form textarea:focus {
      border-color: #667eea;
    }

    /* Email Dialog */
    .email-dialog {
      background: white;
      border-radius: 16px;
      width: 620px;
      max-width: 92vw;
      max-height: 88vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      overflow: hidden;
    }

    .email-dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      background: linear-gradient(135deg, #2196F3 0%, #1565C0 100%);
      color: white;
    }

    .email-dialog-title {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .email-dialog-title h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }

    .email-dialog-header button {
      color: white;
    }

    .email-dialog-body {
      padding: 20px 24px;
      overflow-y: auto;
      flex: 1;
    }

    .email-field {
      margin-bottom: 16px;
    }

    .email-field label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #444;
      margin-bottom: 6px;
    }

    .email-field .required {
      color: #f44336;
    }

    .email-input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
      outline: none;
      transition: border-color 0.2s;
      box-sizing: border-box;
    }

    .email-input:focus {
      border-color: #2196F3;
      box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.1);
    }

    .email-textarea-wrapper {
      position: relative;
    }

    .email-textarea {
      width: 100%;
      padding: 10px 12px;
      padding-bottom: 44px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
      resize: vertical;
      outline: none;
      transition: border-color 0.2s;
      box-sizing: border-box;
      min-height: 100px;
    }

    .email-textarea:focus {
      border-color: #2196F3;
      box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.1);
    }

    .welly-compose-btn {
      position: absolute;
      bottom: 8px;
      right: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      border: 1px solid #e0e0e0;
      border-radius: 20px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .welly-compose-btn:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .welly-compose-btn:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    .welly-compose-btn mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .welly-compose-btn .welly-sparkle {
      color: #ffd700;
    }

    .email-options {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 12px 16px;
      background: #f8f9fa;
      border-radius: 8px;
      margin-top: 4px;
    }

    .email-checkbox {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-size: 13px;
      color: #555;
    }

    .email-checkbox input[type="checkbox"] {
      width: 16px;
      height: 16px;
      accent-color: #2196F3;
      cursor: pointer;
    }

    .email-checkbox mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #888;
    }

    .email-dialog-footer {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      border-top: 1px solid #e0e0e0;
      background: #fafafa;
    }

    .email-dialog-footer button[mat-raised-button] {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .btn-spinner {
      display: inline-block;
    }

    .email-btn {
      background: linear-gradient(135deg, #2196F3, #1565C0) !important;
      color: white !important;
      border-radius: 6px !important;
    }

    .email-btn:hover {
      box-shadow: 0 4px 12px rgba(33, 150, 243, 0.4);
    }
  `]
})
export class DocEditorComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('editorElement') editorElement!: ElementRef;
  @ViewChild('docxFileInput') docxFileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('pdfFileInput') pdfFileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('scanFileInput') scanFileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('imageInput') imageInput!: ElementRef<HTMLInputElement>;

  documentId!: number;
  document: DocumentDetail | null = null;
  documentTitle = '';
  loading = true;
  saving = false;
  lastSaved: Date | null = null;

  editor: Editor | null = null;
  ydoc: Y.Doc | null = null;
  awareness: Awareness | null = null;

  activeUsers: UserPresence[] = [];
  private connectionUserMap = new Map<string, number>(); // connectionId → userId
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

  // Welly AI Assist
  showWellyPanel = false;
  wellyLoading = false;
  wellyResult = '';
  wellyLastAction = '';
  wellyActionLabel = '';
  wellyGeneratePrompt = '';

  // OCR Scanning
  ocrScanning = false;
  ocrStatusMessage = '';
  ocrProgress = 0;

  // Email Document
  showEmailDialog = false;
  emailTo = '';
  emailCc = '';
  emailSubject = '';
  emailBody = '';
  emailAttachDoc = true;
  emailIncludeInBody = true;
  emailSending = false;
  emailComposing = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private docsService: CollaborativeDocsService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private http: HttpClient
  ) {}

  /** Safe base64 encode that won't overflow the call stack on large Uint8Arrays */
  private uint8ToBase64(data: Uint8Array): string {
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.subarray(i, Math.min(i + chunkSize, data.length));
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }

  /** Safe base64 decode to Uint8Array */
  private base64ToUint8(base64: string): Uint8Array {
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  }

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

    // Destroy awareness and Yjs doc
    if (this.awareness) {
      this.awareness.destroy();
    }
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

    // Create Awareness for cursor sharing
    this.awareness = new Awareness(this.ydoc);

    // Load initial state if exists
    if (initialState) {
      try {
        const state = this.base64ToUint8(initialState);
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
        CollaborationCursor.configure({
          provider: {
            awareness: this.awareness,
          } as any,
          user: {
            name: this.currentUserName,
            color: this.currentUserColor,
          },
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
        const base64Update = this.uint8ToBase64(update);
        this.docsService.broadcastUpdate(this.documentId, base64Update).catch(console.error);
      }
    });

    // Listen for awareness changes (cursor/presence) to broadcast via SignalR
    this.awareness!.on('update', ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
      const changedClients = added.concat(updated).concat(removed);
      if (changedClients.includes(this.ydoc!.clientID)) {
        const localState = this.awareness!.getLocalState();
        if (localState) {
          const stateJson = JSON.stringify(localState);
          this.docsService.updateAwareness(this.documentId, stateJson).catch(console.error);
        }
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
              const updateArray = this.base64ToUint8(update);
              Y.applyUpdate(this.ydoc, updateArray, 'remote');
            } catch (e) {
              console.error('Error applying update:', e);
            }
          }
        })
      );

      // Handle awareness updates from other users (remote cursor positions)
      this.subscriptions.push(
        this.docsService.awarenessUpdate$.subscribe(({ connectionId, state }) => {
          // Awareness is handled by the CollaborationCursor extension via the shared awareness instance
          // But we also use SignalR to relay awareness to clients that may not be directly connected
          try {
            const remoteState = JSON.parse(state);
            // Find a free clientID for this remote user
            const states = this.awareness?.getStates();
            let remoteClientId: number | null = null;
            if (states) {
              states.forEach((val, key) => {
                if (val?.['user']?.['name'] === remoteState?.['user']?.['name'] && key !== this.ydoc?.clientID) {
                  remoteClientId = key;
                }
              });
            }
          } catch (e) {
            // Awareness updates are best-effort
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
          this.connectionUserMap.set(connectionId, presence.userId);
          if (!this.activeUsers.find(u => u.userId === presence.userId)) {
            this.activeUsers = [...this.activeUsers, presence];
          }
        })
      );

      this.subscriptions.push(
        this.docsService.userLeft$.subscribe(connectionId => {
          const userId = this.connectionUserMap.get(connectionId);
          this.connectionUserMap.delete(connectionId);
          if (userId) {
            // Only remove the user if they have no other active connections
            const stillConnected = Array.from(this.connectionUserMap.values()).includes(userId);
            if (!stillConnected) {
              this.activeUsers = this.activeUsers.filter(u => u.userId !== userId);
            }
          }
        })
      );

      // Handle sync requests (for reconnection)
      this.subscriptions.push(
        this.docsService.syncRequested$.subscribe(async (connectionId) => {
          if (this.ydoc) {
            const state = Y.encodeStateAsUpdate(this.ydoc);
            const base64State = this.uint8ToBase64(state);
            await this.docsService.sendSyncData(connectionId, base64State);
          }
        })
      );

      this.subscriptions.push(
        this.docsService.syncData$.subscribe(yjsState => {
          if (this.ydoc) {
            try {
              const state = this.base64ToUint8(yjsState);
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
      const base64State = this.uint8ToBase64(state);

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

  // PDF document import
  triggerImportPdf(): void {
    this.pdfFileInput.nativeElement.click();
  }

  async importPdf(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      this.snackBar.open('Please select a valid PDF file (.pdf)', 'Close', { duration: 3000 });
      return;
    }

    this.saving = true;
    this.snackBar.open('Importing PDF document...', undefined, { duration: 2000 });

    try {
      const arrayBuffer = await file.arrayBuffer();

      // Dynamically import pdfjs-dist
      const pdfjsLib = await import('pdfjs-dist');

      // Set the worker source
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

      // Load the PDF document
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const totalPages = pdf.numPages;

      let htmlContent = '';

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        // Group text items by their vertical position (y-coordinate) to reconstruct lines
        const lineMap = new Map<number, { x: number; text: string; fontSize: number; bold: boolean }[]>();

        for (const item of textContent.items) {
          if (!('str' in item) || !item.str.trim()) continue;

          // Round y to group items on the same line (within 2px tolerance)
          const y = Math.round((item as any).transform[5] * 10) / 10;
          const x = (item as any).transform[4];
          const fontSize = Math.abs((item as any).transform[0]) || 12;
          const fontName: string = (item as any).fontName || '';
          const bold = fontName.toLowerCase().includes('bold');

          if (!lineMap.has(y)) {
            lineMap.set(y, []);
          }
          lineMap.get(y)!.push({ x, text: item.str, fontSize, bold });
        }

        // Sort lines top-to-bottom (PDF y-axis is bottom-up, so sort descending)
        const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);

        if (pageNum > 1) {
          htmlContent += '<hr>';
        }

        for (const y of sortedYs) {
          const lineItems = lineMap.get(y)!;
          // Sort items left-to-right
          lineItems.sort((a, b) => a.x - b.x);

          const lineText = lineItems.map(item => item.text).join(' ');
          const avgFontSize = lineItems.reduce((sum, item) => sum + item.fontSize, 0) / lineItems.length;
          const isBold = lineItems.some(item => item.bold);

          // Determine heading level based on font size
          if (avgFontSize >= 22) {
            htmlContent += `<h1>${this.escapeHtml(lineText)}</h1>`;
          } else if (avgFontSize >= 18) {
            htmlContent += `<h2>${this.escapeHtml(lineText)}</h2>`;
          } else if (avgFontSize >= 15) {
            htmlContent += `<h3>${this.escapeHtml(lineText)}</h3>`;
          } else if (isBold) {
            htmlContent += `<p><strong>${this.escapeHtml(lineText)}</strong></p>`;
          } else {
            htmlContent += `<p>${this.escapeHtml(lineText)}</p>`;
          }
        }
      }

      if (this.editor && htmlContent) {
        this.editor.chain().focus().setContent(htmlContent).run();
        this.snackBar.open(`PDF imported successfully! (${totalPages} page${totalPages > 1 ? 's' : ''})`, 'Close', { duration: 3000 });
        this.autosaveSubject.next();
      } else if (!htmlContent) {
        this.snackBar.open('PDF appears to contain no extractable text (may be scanned/image-based)', 'Close', { duration: 5000 });
      }
    } catch (error) {
      console.error('Error importing PDF:', error);
      this.snackBar.open('Failed to import PDF document', 'Close', { duration: 3000 });
    } finally {
      this.saving = false;
      input.value = '';
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ═══════════════════════════════════════════
  // Scanned Document Import (OCR)
  // ═══════════════════════════════════════════

  triggerScanImport(): void {
    this.scanFileInput.nativeElement.click();
  }

  async importScanned(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const validExts = ['.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.tif', '.webp', '.pdf'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!validExts.includes(ext)) {
      this.snackBar.open('Please select an image or PDF file', 'Close', { duration: 3000 });
      return;
    }

    this.ocrScanning = true;
    this.ocrProgress = 0;
    this.ocrStatusMessage = 'Preparing document for scanning...';

    try {
      let imageSources: (string | Blob)[] = [];

      if (ext === '.pdf') {
        // Render PDF pages to images for OCR
        this.ocrStatusMessage = 'Rendering PDF pages...';
        imageSources = await this.renderPdfToImages(file);
      } else {
        imageSources = [file];
      }

      if (imageSources.length === 0) {
        this.snackBar.open('Could not process the document', 'Close', { duration: 3000 });
        return;
      }

      // Run OCR with Tesseract.js
      this.ocrStatusMessage = 'Loading OCR engine...';
      const { createWorker } = await import('tesseract.js');

      let fullText = '';
      const totalPages = imageSources.length;

      // Create a Tesseract worker
      let currentPage = 0;
      const worker = await createWorker('eng', undefined, {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            this.ocrProgress = Math.round(((currentPage + m.progress) / totalPages) * 100);
          } else if (m.status === 'loading language traineddata') {
            this.ocrStatusMessage = 'Loading language data...';
          }
        }
      });

      for (let i = 0; i < totalPages; i++) {
        currentPage = i;
        this.ocrStatusMessage = totalPages > 1
          ? `Scanning page ${i + 1} of ${totalPages}...`
          : 'Scanning document...';

        const result = await worker.recognize(imageSources[i] as any);

        if (result.data.text.trim()) {
          if (i > 0) fullText += '\n\n---\n\n';
          fullText += result.data.text.trim();
        }
      }

      await worker.terminate();

      if (!fullText.trim()) {
        this.snackBar.open('No text could be extracted from the scanned document', 'Close', { duration: 4000 });
        return;
      }

      // Send to Welly for cleanup and formatting
      this.ocrStatusMessage = 'Welly is cleaning up the extracted text...';
      this.ocrProgress = 0;

      const cleanedHtml = await this.wellyCleanupOcrText(fullText);

      if (this.editor && cleanedHtml) {
        this.editor.chain().focus().setContent(cleanedHtml).run();
        this.snackBar.open(
          `Scanned document imported! (${totalPages} page${totalPages > 1 ? 's' : ''})`,
          'Close',
          { duration: 4000 }
        );
        this.autosaveSubject.next();
      }
    } catch (error) {
      console.error('Error scanning document:', error);
      this.snackBar.open('Failed to scan document. Please try again.', 'Close', { duration: 3000 });
    } finally {
      this.ocrScanning = false;
      this.ocrProgress = 0;
      this.ocrStatusMessage = '';
      input.value = '';
    }
  }

  private async renderPdfToImages(file: File): Promise<Blob[]> {
    const arrayBuffer = await file.arrayBuffer();
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const blobs: Blob[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      // Render at 2x scale for better OCR accuracy
      const scale = 2.0;
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;

      await page.render({ canvasContext: ctx, viewport }).promise;

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/png');
      });
      blobs.push(blob);
    }

    return blobs;
  }

  private wellyCleanupOcrText(rawText: string): Promise<string> {
    return new Promise((resolve) => {
      this.http.post<{ result: string }>(`${environment.apiUrl}/aichat/welly-assist`, {
        assistType: 'ocr-cleanup',
        content: rawText
      }).subscribe({
        next: (res) => {
          // Convert the cleaned text to HTML paragraphs
          let html = res.result;
          // If Welly returned plain text, convert to paragraphs
          if (!html.includes('<p>') && !html.includes('<h')) {
            html = html
              .split('\n\n')
              .filter((p: string) => p.trim())
              .map((p: string) => {
                const trimmed = p.trim();
                // Detect headings from common OCR patterns
                if (trimmed === trimmed.toUpperCase() && trimmed.length < 100 && trimmed.length > 2) {
                  return `<h2>${this.escapeHtml(trimmed)}</h2>`;
                }
                return `<p>${this.escapeHtml(trimmed)}</p>`;
              })
              .join('');
          }
          resolve(html);
        },
        error: () => {
          // If Welly fails, fall back to raw text formatted as paragraphs
          const html = rawText
            .split('\n\n')
            .filter(p => p.trim())
            .map(p => `<p>${this.escapeHtml(p.trim())}</p>`)
            .join('');
          resolve(html);
        }
      });
    });
  }

  // ═══════════════════════════════════════════
  // Email Document Methods
  // ═══════════════════════════════════════════

  openEmailDialog(): void {
    if (!this.editor) return;
    this.emailTo = '';
    this.emailCc = '';
    this.emailSubject = this.documentTitle || 'Document';
    this.emailBody = '';
    this.emailAttachDoc = true;
    this.emailIncludeInBody = true;
    this.emailSending = false;
    this.emailComposing = false;
    this.showEmailDialog = true;
  }

  wellyComposeEmail(): void {
    if (this.emailComposing) return;
    this.emailComposing = true;

    const docTitle = this.documentTitle || 'Document';
    const prompt = this.emailBody.trim()
      ? `The user wants to share a document titled "${docTitle}". Here's what they want to say: "${this.emailBody}". Please compose the full email body message based on this.`
      : `The user wants to share a document titled "${docTitle}" with colleagues. Please compose a short, professional email body message to accompany this document. Be friendly and concise.`;

    this.http.post<{ result: string }>(`${environment.apiUrl}/aichat/welly-assist`, {
      assistType: 'compose-email',
      content: prompt
    }).subscribe({
      next: (res) => {
        this.emailBody = res.result;
        this.emailComposing = false;
      },
      error: () => {
        this.snackBar.open('Welly could not compose the email. Please write it manually.', 'Close', { duration: 3000 });
        this.emailComposing = false;
      }
    });
  }

  sendEmail(): void {
    if (!this.emailTo.trim()) {
      this.snackBar.open('Please enter at least one recipient email address', 'Close', { duration: 3000 });
      return;
    }

    if (!this.editor) return;

    const htmlContent = this.editor.getHTML();
    const toList = this.emailTo.split(/[,;]/).map(e => e.trim()).filter(e => e);
    const ccList = this.emailCc ? this.emailCc.split(/[,;]/).map(e => e.trim()).filter(e => e) : [];

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = toList.filter(e => !emailRegex.test(e));
    if (invalidEmails.length > 0) {
      this.snackBar.open(`Invalid email address: ${invalidEmails[0]}`, 'Close', { duration: 3000 });
      return;
    }

    this.emailSending = true;

    this.docsService.sendDocumentEmail(this.documentId, {
      to: toList,
      cc: ccList.length > 0 ? ccList : undefined,
      subject: this.emailSubject,
      body: this.emailBody,
      htmlContent: htmlContent,
      attachDocument: this.emailAttachDoc,
      includeInBody: this.emailIncludeInBody
    }).subscribe({
      next: () => {
        this.snackBar.open('📧 Email sent successfully!', 'Close', { duration: 4000 });
        this.showEmailDialog = false;
        this.emailSending = false;
      },
      error: (err) => {
        console.error('Email send error:', err);
        const msg = err.error?.message || 'Failed to send email. Please try again.';
        this.snackBar.open(msg, 'Close', { duration: 5000 });
        this.emailSending = false;
      }
    });
  }

  // ═══════════════════════════════════════════
  // Welly AI Assist Methods
  // ═══════════════════════════════════════════

  wellyAssist(action: string, targetLanguage?: string): void {
    this.wellyLastAction = action;
    this.wellyResult = '';
    this.showWellyPanel = true;

    if (action === 'generate') {
      this.wellyGeneratePrompt = '';
      this.wellyLoading = false;
      return;
    }

    // Get selected text or full document text
    if (!this.editor) return;
    const { from, to } = this.editor.state.selection;
    const selectedText = from !== to ? this.editor.state.doc.textBetween(from, to, '\n') : '';
    const content = selectedText || this.editor.getText();

    if (!content.trim()) {
      this.snackBar.open('Please write some text first, or select text to process', 'Close', { duration: 3000 });
      this.showWellyPanel = false;
      return;
    }

    this.wellyActionLabel = action === 'grammar' ? 'checking grammar' :
      action === 'summarize' ? 'summarizing' :
      action === 'rewrite' ? 'rewriting' :
      action === 'improve' ? 'improving' :
      action === 'translate' ? `translating to ${targetLanguage}` : 'processing';

    this.wellyLoading = true;

    this.http.post<{ result: string }>(`${environment.apiUrl}/aichat/welly-assist`, {
      assistType: action,
      content: content,
      targetLanguage: targetLanguage
    }).subscribe({
      next: (res) => {
        this.wellyResult = res.result;
        this.wellyLoading = false;
      },
      error: (err) => {
        console.error('Welly assist error:', err);
        this.snackBar.open('Welly could not process your request. Please try again.', 'Close', { duration: 3000 });
        this.wellyLoading = false;
        this.showWellyPanel = false;
      }
    });
  }

  submitWellyGenerate(): void {
    if (!this.wellyGeneratePrompt.trim()) return;
    this.wellyLoading = true;
    this.wellyActionLabel = 'generating content';

    this.http.post<{ result: string }>(`${environment.apiUrl}/aichat/welly-assist`, {
      assistType: 'generate',
      content: this.wellyGeneratePrompt
    }).subscribe({
      next: (res) => {
        this.wellyResult = res.result;
        this.wellyLoading = false;
      },
      error: (err) => {
        console.error('Welly generate error:', err);
        this.snackBar.open('Welly could not generate content. Please try again.', 'Close', { duration: 3000 });
        this.wellyLoading = false;
      }
    });
  }

  applyWellyResult(): void {
    if (!this.editor || !this.wellyResult) return;
    const { from, to } = this.editor.state.selection;
    if (from !== to) {
      // Replace selected text
      this.editor.chain().focus().deleteRange({ from, to }).insertContentAt(from, this.wellyResult).run();
    } else {
      // Replace full document
      this.editor.chain().focus().setContent(this.wellyResult).run();
    }
    this.snackBar.open('Applied to document ✓', 'Close', { duration: 2000 });
    this.showWellyPanel = false;
    this.autosaveSubject.next();
  }

  insertWellyResult(): void {
    if (!this.editor || !this.wellyResult) return;
    this.editor.chain().focus().insertContent(this.wellyResult).run();
    this.snackBar.open('Inserted into document ✓', 'Close', { duration: 2000 });
    this.showWellyPanel = false;
    this.autosaveSubject.next();
  }

  copyWellyResult(): void {
    navigator.clipboard.writeText(this.wellyResult).then(() => {
      this.snackBar.open('Copied to clipboard ✓', 'Close', { duration: 2000 });
    });
  }
}
