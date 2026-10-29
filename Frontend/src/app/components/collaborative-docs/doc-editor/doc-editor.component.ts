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
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Subscription, debounceTime, Subject } from 'rxjs';
import { CollaborativeDocsService } from '../../../services/collaborative-docs.service';
import { AuthService } from '../../../services/auth.service';
import { WellyActivityService } from '../../../services/welly-activity.service';
import { DocumentDetail, UserPresence } from '../../../models/collaborative-doc.model';
import { environment } from '../../../../environments/environment';
import { ConfirmService } from '../../../ui/confirm.service';
import { ToastService } from '../../../ui/toast.service';
import { SkeletonRowsComponent } from '../../../ui/skeleton-rows/skeleton-rows.component';
import { EmptyStateComponent } from '../../../ui/empty-state/empty-state.component';

// Mammoth for Word document import
import * as mammoth from 'mammoth';

// Tiptap imports
import { Editor, Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Link from '@tiptap/extension-link';

// Font size as a TextStyle attribute (Word-style pt sizes)
const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() { return { types: ['textStyle'] }; },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (element: HTMLElement) => element.style.fontSize || null,
          renderHTML: (attributes: any) => attributes['fontSize'] ? { style: `font-size: ${attributes['fontSize']}` } : {},
        },
      },
    }];
  },
  addCommands(): any {
    return {
      setFontSize: (size: string) => ({ chain }: any) => chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize: () => ({ chain }: any) => chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

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
    MatChipsModule,
    MatDividerModule,
    MatTabsModule,
    MatSelectModule,
    MatFormFieldModule,
    SkeletonRowsComponent,
    EmptyStateComponent
  ],
  template: `
    <div class="editor-container" [class.loading]="loading">
      <!-- Title Bar -->
      <div class="title-bar">
        <div class="title-bar-left">
          <button aria-label="Back to Documents" mat-icon-button routerLink="/docs" matTooltip="Back to Documents">
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
                <button mat-menu-item (click)="exportAsWord()">
                  <mat-icon>description</mat-icon>
                  <span>Export as Word (.doc)</span>
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
          <button [attr.aria-label]="darkMode ? 'Light mode' : 'Dark mode'" mat-icon-button (click)="darkMode = !darkMode" [matTooltip]="darkMode ? 'Light mode' : 'Dark mode'">
            <mat-icon>{{ darkMode ? 'light_mode' : 'dark_mode' }}</mat-icon>
          </button>
          <button mat-button class="topbar-btn" [class.active]="showComments" (click)="toggleComments()" matTooltip="Show comments">
            <mat-icon>comment</mat-icon> Comments
            @if (comments.length) { <span class="comment-count">{{ comments.length }}</span> }
          </button>
          <button mat-button class="topbar-btn" [matMenuTriggerFor]="editingModeMenu" matTooltip="Editing mode">
            <mat-icon>{{ editingMode === 'editing' ? 'edit' : 'visibility' }}</mat-icon>
            {{ editingMode === 'editing' ? 'Editing' : 'Viewing' }}
            <mat-icon class="dropdown-caret">arrow_drop_down</mat-icon>
          </button>
          <mat-menu #editingModeMenu="matMenu">
            <button mat-menu-item (click)="setEditingMode('editing')">
              <mat-icon>edit</mat-icon><span>Editing — make changes</span>
            </button>
            <button mat-menu-item (click)="setEditingMode('viewing')">
              <mat-icon>visibility</mat-icon><span>Viewing — read only</span>
            </button>
          </mat-menu>
          <button mat-flat-button color="primary" class="share-btn" (click)="shareDocument()" matTooltip="Copy link to this document">
            <mat-icon>share</mat-icon> Share
          </button>
          <div class="connection-status" [class]="connectionState">
            <mat-icon>{{ getConnectionIcon() }}</mat-icon>
          </div>
        </div>
      </div>

      <!-- Ribbon -->
      <div class="ribbon">
        <div class="ribbon-tabs">
          <button class="ribbon-tab file-tab" [matMenuTriggerFor]="ribbonFileMenu">File</button>
          <mat-menu #ribbonFileMenu="matMenu">
            <button mat-menu-item (click)="triggerImportDocx()"><mat-icon>upload_file</mat-icon><span>Import Word Document</span></button>
            <button mat-menu-item (click)="triggerImportPdf()"><mat-icon>picture_as_pdf</mat-icon><span>Import PDF</span></button>
            <button mat-menu-item (click)="triggerScanImport()"><mat-icon>document_scanner</mat-icon><span>Import Scanned Document</span></button>
            <mat-divider></mat-divider>
            <button mat-menu-item (click)="exportAsWord()"><mat-icon>description</mat-icon><span>Export as Word (.doc)</span></button>
            <button mat-menu-item (click)="exportAsHtml()"><mat-icon>download</mat-icon><span>Export as HTML</span></button>
            <mat-divider></mat-divider>
            <button mat-menu-item (click)="openEmailDialog()"><mat-icon>email</mat-icon><span>Email Document</span></button>
            <button mat-menu-item (click)="print()"><mat-icon>print</mat-icon><span>Print</span></button>
          </mat-menu>
          <button class="ribbon-tab" [class.active]="activeRibbonTab === 'home'" (click)="activeRibbonTab = 'home'">Home</button>
          <button class="ribbon-tab" [class.active]="activeRibbonTab === 'insert'" (click)="activeRibbonTab = 'insert'">Insert</button>
          <button class="ribbon-tab" [class.active]="activeRibbonTab === 'draw'" (click)="activeRibbonTab = 'draw'">Draw</button>
          <button class="ribbon-tab" [class.active]="activeRibbonTab === 'design'" (click)="activeRibbonTab = 'design'">Design</button>
          <button class="ribbon-tab" [class.active]="activeRibbonTab === 'layout'" (click)="activeRibbonTab = 'layout'">Layout</button>
          <button class="ribbon-tab" [class.active]="activeRibbonTab === 'references'" (click)="activeRibbonTab = 'references'">References</button>
          <button class="ribbon-tab" [class.active]="activeRibbonTab === 'mailings'" (click)="activeRibbonTab = 'mailings'">Mailings</button>
          <button class="ribbon-tab" [class.active]="activeRibbonTab === 'review'" (click)="activeRibbonTab = 'review'">Review</button>
          <button class="ribbon-tab" [class.active]="activeRibbonTab === 'view'" (click)="activeRibbonTab = 'view'">View</button>
          <button class="ribbon-tab" [class.active]="activeRibbonTab === 'help'" (click)="activeRibbonTab = 'help'">Help</button>
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
                  <select class="font-select" [(ngModel)]="selectedFont" (change)="setFont()" matTooltip="Font">
                    @for (f of fontFamilies; track f) {
                      <option [value]="f" [style.fontFamily]="f">{{ f }}</option>
                    }
                  </select>
                  <select class="size-select" [(ngModel)]="selectedFontSize" (change)="setFontSize()" matTooltip="Font size">
                    @for (s of fontSizes; track s) {
                      <option [value]="s">{{ s }}</option>
                    }
                  </select>
                </div>
                <div class="font-row">
                  <button aria-label="Bold (Ctrl+B)" class="ribbon-icon-btn" [class.active]="editor?.isActive('bold')" (click)="toggleBold()" matTooltip="Bold (Ctrl+B)">
                    <mat-icon>format_bold</mat-icon>
                  </button>
                  <button aria-label="Italic (Ctrl+I)" class="ribbon-icon-btn" [class.active]="editor?.isActive('italic')" (click)="toggleItalic()" matTooltip="Italic (Ctrl+I)">
                    <mat-icon>format_italic</mat-icon>
                  </button>
                  <button aria-label="Underline (Ctrl+U)" class="ribbon-icon-btn" [class.active]="editor?.isActive('underline')" (click)="toggleUnderline()" matTooltip="Underline (Ctrl+U)">
                    <mat-icon>format_underlined</mat-icon>
                  </button>
                  <button aria-label="Strikethrough" class="ribbon-icon-btn" [class.active]="editor?.isActive('strike')" (click)="toggleStrike()" matTooltip="Strikethrough">
                    <mat-icon>strikethrough_s</mat-icon>
                  </button>
                  <button aria-label="Subscript" class="ribbon-icon-btn" [class.active]="editor?.isActive('subscript')" (click)="toggleSubscript()" matTooltip="Subscript">
                    <mat-icon>subscript</mat-icon>
                  </button>
                  <button aria-label="Superscript" class="ribbon-icon-btn" [class.active]="editor?.isActive('superscript')" (click)="toggleSuperscript()" matTooltip="Superscript">
                    <mat-icon>superscript</mat-icon>
                  </button>
                  <div class="color-btn-wrapper">
                    <button class="ribbon-icon-btn" [matMenuTriggerFor]="textColorMenu" matTooltip="Font colour">
                      <mat-icon>format_color_text</mat-icon>
                      <div class="color-indicator" [style.background]="selectedTextColor"></div>
                    </button>
                    <mat-menu #textColorMenu="matMenu" class="color-palette-menu">
                      <div class="color-palette" (click)="$event.stopPropagation()">
                        @for (c of textColors; track c) {
                          <button class="color-swatch" [style.background]="c" (click)="setTextColor(c)" [matTooltip]="c"></button>
                        }
                      </div>
                      <button mat-menu-item (click)="unsetTextColor()">
                        <mat-icon>format_clear</mat-icon> Automatic
                      </button>
                    </mat-menu>
                  </div>
                  <button aria-label="Highlight" class="ribbon-icon-btn" [class.active]="editor?.isActive('highlight')" (click)="toggleHighlight()" matTooltip="Highlight">
                    <mat-icon>highlight</mat-icon>
                  </button>
                  <button aria-label="Insert link (Ctrl+K)" class="ribbon-icon-btn" [class.active]="editor?.isActive('link')" (click)="insertLink()" matTooltip="Insert link (Ctrl+K)">
                    <mat-icon>link</mat-icon>
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
                  <button aria-label="Bullets" class="ribbon-icon-btn" [class.active]="editor?.isActive('bulletList')" (click)="toggleBulletList()" matTooltip="Bullets">
                    <mat-icon>format_list_bulleted</mat-icon>
                  </button>
                  <button aria-label="Numbering" class="ribbon-icon-btn" [class.active]="editor?.isActive('orderedList')" (click)="toggleOrderedList()" matTooltip="Numbering">
                    <mat-icon>format_list_numbered</mat-icon>
                  </button>
                  <button aria-label="Checklist" class="ribbon-icon-btn" [class.active]="editor?.isActive('taskList')" (click)="toggleTaskList()" matTooltip="Checklist">
                    <mat-icon>checklist</mat-icon>
                  </button>
                  <button aria-label="Decrease Indent" class="ribbon-icon-btn" (click)="decreaseIndent()" matTooltip="Decrease Indent">
                    <mat-icon>format_indent_decrease</mat-icon>
                  </button>
                  <button aria-label="Increase Indent" class="ribbon-icon-btn" (click)="increaseIndent()" matTooltip="Increase Indent">
                    <mat-icon>format_indent_increase</mat-icon>
                  </button>
                </div>
                <div class="paragraph-row">
                  <button aria-label="Align Left" class="ribbon-icon-btn" [class.active]="editor?.isActive({ textAlign: 'left' })" (click)="setTextAlign('left')" matTooltip="Align Left">
                    <mat-icon>format_align_left</mat-icon>
                  </button>
                  <button aria-label="Center" class="ribbon-icon-btn" [class.active]="editor?.isActive({ textAlign: 'center' })" (click)="setTextAlign('center')" matTooltip="Center">
                    <mat-icon>format_align_center</mat-icon>
                  </button>
                  <button aria-label="Align Right" class="ribbon-icon-btn" [class.active]="editor?.isActive({ textAlign: 'right' })" (click)="setTextAlign('right')" matTooltip="Align Right">
                    <mat-icon>format_align_right</mat-icon>
                  </button>
                  <button aria-label="Justify" class="ribbon-icon-btn" [class.active]="editor?.isActive({ textAlign: 'justify' })" (click)="setTextAlign('justify')" matTooltip="Justify">
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
                <button class="style-btn" [class.active]="editor?.isActive('heading', { level: 1 }) && false" (click)="applyTitleStyle()">
                  <span class="style-preview title-style">Title</span>
                </button>
                <button class="style-btn" [class.active]="editor?.isActive('blockquote')" (click)="toggleBlockquote()">
                  <span class="style-preview quote-style">“Quote”</span>
                </button>
              </div>
              <div class="ribbon-group-label">Styles</div>
            </div>

            <div class="ribbon-separator"></div>

            <!-- Editing Group -->
            <div class="ribbon-group">
              <div class="ribbon-group-content editing-group">
                <button class="ribbon-btn vertical" [matMenuTriggerFor]="findMenu" matTooltip="Find, Replace, Select">
                  <mat-icon>search</mat-icon>
                  <span>Find</span>
                </button>
                <mat-menu #findMenu="matMenu">
                  <button mat-menu-item (click)="openFind(false)"><mat-icon>search</mat-icon><span>Find (Ctrl+F)</span></button>
                  <button mat-menu-item (click)="openFind(true)"><mat-icon>find_replace</mat-icon><span>Replace (Ctrl+H)</span></button>
                  <button mat-menu-item (click)="selectAll()"><mat-icon>select_all</mat-icon><span>Select All (Ctrl+A)</span></button>
                </mat-menu>
                <button class="ribbon-btn vertical" [class.active]="dictating" (click)="toggleDictation()" matTooltip="Dictate — speech to text">
                  <mat-icon [class.dictating-mic]="dictating">{{ dictating ? 'mic' : 'mic_none' }}</mat-icon>
                  <span>{{ dictating ? 'Stop' : 'Dictate' }}</span>
                </button>
                <button class="ribbon-btn vertical" (click)="wellyAssist('grammar')" matTooltip="Editor — check spelling, grammar and style">
                  <mat-icon>fact_check</mat-icon>
                  <span>Editor</span>
                </button>
                <button class="ribbon-btn vertical" (click)="addComment()" matTooltip="New comment on selection">
                  <mat-icon>add_comment</mat-icon>
                  <span>Comment</span>
                </button>
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

        <!-- Draw Tab -->
        @if (activeRibbonTab === 'draw') {
          <div class="ribbon-content">
            <div class="ribbon-group">
              <div class="ribbon-group-content">
                @for (c of highlightColors; track c) {
                  <button class="draw-pen" [class.active]="editor?.isActive('highlight', { color: c })" [style.background]="c" (click)="setHighlight(c)" [matTooltip]="'Highlighter ' + c"></button>
                }
              </div>
              <div class="ribbon-group-label">Highlighters</div>
            </div>
            <div class="ribbon-separator"></div>
            <div class="ribbon-group">
              <div class="ribbon-group-content">
                <button class="ribbon-btn large" (click)="removeHighlight()" matTooltip="Remove highlight from selection">
                  <mat-icon>ink_eraser</mat-icon>
                  <span>Eraser</span>
                </button>
              </div>
              <div class="ribbon-group-label">Erase</div>
            </div>
          </div>
        }

        <!-- Design Tab -->
        @if (activeRibbonTab === 'design') {
          <div class="ribbon-content">
            <div class="ribbon-group">
              <div class="ribbon-group-content">
                @for (t of docThemes; track t.name) {
                  <button class="theme-btn" [class.active]="activeTheme === t.name" (click)="applyTheme(t)" [matTooltip]="t.name">
                    <span class="theme-preview" [style.fontFamily]="t.font" [style.color]="t.accent">Aa</span>
                    <span class="theme-name">{{ t.name }}</span>
                  </button>
                }
              </div>
              <div class="ribbon-group-label">Themes</div>
            </div>
            <div class="ribbon-separator"></div>
            <div class="ribbon-group">
              <div class="ribbon-group-content">
                <button class="ribbon-btn large" [matMenuTriggerFor]="pageColorMenu" matTooltip="Page colour">
                  <mat-icon>format_color_fill</mat-icon>
                  <span>Page Colour</span>
                </button>
                <mat-menu #pageColorMenu="matMenu" class="color-palette-menu">
                  <div class="color-palette" (click)="$event.stopPropagation()">
                    @for (c of pageColors; track c) {
                      <button class="color-swatch" [style.background]="c" (click)="pageColor = c" [matTooltip]="c"></button>
                    }
                  </div>
                  <button mat-menu-item (click)="pageColor = '#ffffff'"><mat-icon>format_clear</mat-icon> White</button>
                </mat-menu>
              </div>
              <div class="ribbon-group-label">Page Background</div>
            </div>
          </div>
        }

        <!-- Layout Tab -->
        @if (activeRibbonTab === 'layout') {
          <div class="ribbon-content">
            <div class="ribbon-group">
              <div class="ribbon-group-content">
                <button class="ribbon-btn large" [matMenuTriggerFor]="marginsMenu" matTooltip="Page margins">
                  <mat-icon>select_all</mat-icon>
                  <span>Margins</span>
                </button>
                <mat-menu #marginsMenu="matMenu">
                  <button mat-menu-item (click)="setMargins('narrow')"><span [class.menu-active]="marginPreset === 'narrow'">Narrow (1.27 cm)</span></button>
                  <button mat-menu-item (click)="setMargins('normal')"><span [class.menu-active]="marginPreset === 'normal'">Normal (2.54 cm)</span></button>
                  <button mat-menu-item (click)="setMargins('wide')"><span [class.menu-active]="marginPreset === 'wide'">Wide (5.08 cm)</span></button>
                </mat-menu>
                <button class="ribbon-btn large" (click)="toggleOrientation()" matTooltip="Toggle portrait / landscape">
                  <mat-icon>{{ pageOrientation === 'portrait' ? 'crop_portrait' : 'crop_landscape' }}</mat-icon>
                  <span>{{ pageOrientation === 'portrait' ? 'Portrait' : 'Landscape' }}</span>
                </button>
                <button class="ribbon-btn large" [matMenuTriggerFor]="sizeMenu" matTooltip="Page size">
                  <mat-icon>aspect_ratio</mat-icon>
                  <span>Size</span>
                </button>
                <mat-menu #sizeMenu="matMenu">
                  <button mat-menu-item (click)="pageSize = 'a4'"><span [class.menu-active]="pageSize === 'a4'">A4 (21 × 29.7 cm)</span></button>
                  <button mat-menu-item (click)="pageSize = 'letter'"><span [class.menu-active]="pageSize === 'letter'">Letter (21.6 × 27.9 cm)</span></button>
                  <button mat-menu-item (click)="pageSize = 'legal'"><span [class.menu-active]="pageSize === 'legal'">Legal (21.6 × 35.6 cm)</span></button>
                </mat-menu>
              </div>
              <div class="ribbon-group-label">Page Setup</div>
            </div>
            <div class="ribbon-separator"></div>
            <div class="ribbon-group">
              <div class="ribbon-group-content">
                <button class="ribbon-btn vertical" (click)="decreaseIndent()" matTooltip="Decrease Indent">
                  <mat-icon>format_indent_decrease</mat-icon>
                  <span>Outdent</span>
                </button>
                <button class="ribbon-btn vertical" (click)="increaseIndent()" matTooltip="Increase Indent">
                  <mat-icon>format_indent_increase</mat-icon>
                  <span>Indent</span>
                </button>
              </div>
              <div class="ribbon-group-label">Paragraph</div>
            </div>
            <div class="ribbon-separator"></div>
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
                <button class="ribbon-btn vertical" (click)="transformText('capitalize')" matTooltip="Capitalize Each Word">
                  <mat-icon>text_fields</mat-icon>
                  <span>Title</span>
                </button>
              </div>
              <div class="ribbon-group-label">Change Case</div>
            </div>
          </div>
        }

        <!-- References Tab -->
        @if (activeRibbonTab === 'references') {
          <div class="ribbon-content">
            <div class="ribbon-group">
              <div class="ribbon-group-content">
                <button class="ribbon-btn large" (click)="insertTableOfContents()" matTooltip="Insert a table of contents built from the document headings">
                  <mat-icon>toc</mat-icon>
                  <span>Table of Contents</span>
                </button>
              </div>
              <div class="ribbon-group-label">Table of Contents</div>
            </div>
            <div class="ribbon-separator"></div>
            <div class="ribbon-group">
              <div class="ribbon-group-content">
                <button class="ribbon-btn large" (click)="insertFootnote()" matTooltip="Insert footnote at the end of the document">
                  <mat-icon>subdirectory_arrow_right</mat-icon>
                  <span>Footnote</span>
                </button>
              </div>
              <div class="ribbon-group-label">Footnotes</div>
            </div>
            <div class="ribbon-separator"></div>
            <div class="ribbon-group">
              <div class="ribbon-group-content">
                <button class="ribbon-btn large" (click)="insertLink()" matTooltip="Insert hyperlink">
                  <mat-icon>link</mat-icon>
                  <span>Link</span>
                </button>
              </div>
              <div class="ribbon-group-label">Links</div>
            </div>
          </div>
        }

        <!-- Mailings Tab -->
        @if (activeRibbonTab === 'mailings') {
          <div class="ribbon-content">
            <div class="ribbon-group">
              <div class="ribbon-group-content">
                <button class="ribbon-btn large email-btn" (click)="openEmailDialog()" matTooltip="Email this document">
                  <mat-icon>email</mat-icon>
                  <span>Email Document</span>
                </button>
                <button class="ribbon-btn large" (click)="exportAsWord()" matTooltip="Export as Word attachment">
                  <mat-icon>attach_file</mat-icon>
                  <span>Export .doc</span>
                </button>
                <button class="ribbon-btn large" (click)="print()" matTooltip="Print / PDF">
                  <mat-icon>print</mat-icon>
                  <span>Print</span>
                </button>
              </div>
              <div class="ribbon-group-label">Send</div>
            </div>
          </div>
        }

        <!-- Review Tab -->
        @if (activeRibbonTab === 'review') {
          <div class="ribbon-content">
            <div class="ribbon-group">
              <div class="ribbon-group-content">
                <button class="ribbon-btn large welly-btn" (click)="wellyAssist('grammar')" matTooltip="Check spelling & grammar with Welly AI">
                  <mat-icon>spellcheck</mat-icon>
                  <span>Spelling &amp; Grammar</span>
                </button>
                <button class="ribbon-btn large" (click)="wellyAssist('improve')" matTooltip="Improve writing with Welly AI">
                  <mat-icon>trending_up</mat-icon>
                  <span>Improve</span>
                </button>
                <button class="ribbon-btn large" (click)="wellyAssist('summarize')" matTooltip="Summarize with Welly AI">
                  <mat-icon>summarize</mat-icon>
                  <span>Summarize</span>
                </button>
              </div>
              <div class="ribbon-group-label">Proofing</div>
            </div>
            <div class="ribbon-separator"></div>
            <div class="ribbon-group">
              <div class="ribbon-group-content">
                <button class="ribbon-btn large" [matMenuTriggerFor]="reviewTranslateMenu" matTooltip="Translate the document">
                  <mat-icon>translate</mat-icon>
                  <span>Translate</span>
                </button>
                <mat-menu #reviewTranslateMenu="matMenu">
                  <button mat-menu-item (click)="wellyAssist('translate', 'Afrikaans')">Afrikaans</button>
                  <button mat-menu-item (click)="wellyAssist('translate', 'Zulu')">Zulu</button>
                  <button mat-menu-item (click)="wellyAssist('translate', 'Xhosa')">Xhosa</button>
                  <button mat-menu-item (click)="wellyAssist('translate', 'Sotho')">Sotho</button>
                  <button mat-menu-item (click)="wellyAssist('translate', 'Tswana')">Tswana</button>
                  <button mat-menu-item (click)="wellyAssist('translate', 'French')">French</button>
                  <button mat-menu-item (click)="wellyAssist('translate', 'Portuguese')">Portuguese</button>
                </mat-menu>
              </div>
              <div class="ribbon-group-label">Language</div>
            </div>
            <div class="ribbon-separator"></div>
            <div class="ribbon-group">
              <div class="ribbon-group-content">
                <div class="word-count-panel">
                  <div><strong>{{ wordCount }}</strong> words</div>
                  <div><strong>{{ charCount }}</strong> characters</div>
                </div>
              </div>
              <div class="ribbon-group-label">Word Count</div>
            </div>
          </div>
        }

        <!-- Help Tab -->
        @if (activeRibbonTab === 'help') {
          <div class="ribbon-content">
            <div class="ribbon-group">
              <div class="ribbon-group-content">
                <button class="ribbon-btn large" (click)="showShortcuts = !showShortcuts" [class.active]="showShortcuts" matTooltip="Keyboard shortcuts">
                  <mat-icon>keyboard</mat-icon>
                  <span>Shortcuts</span>
                </button>
                <button class="ribbon-btn large welly-btn" (click)="wellyAssist('generate')" matTooltip="Ask Welly AI for help">
                  <mat-icon class="welly-icon">auto_awesome</mat-icon>
                  <span>Ask Welly</span>
                </button>
              </div>
              <div class="ribbon-group-label">Help</div>
            </div>
            @if (showShortcuts) {
              <div class="ribbon-separator"></div>
              <div class="ribbon-group shortcuts-group">
                <div class="ribbon-group-content shortcuts-list">
                  <span><kbd>Ctrl+B</kbd> Bold</span>
                  <span><kbd>Ctrl+I</kbd> Italic</span>
                  <span><kbd>Ctrl+U</kbd> Underline</span>
                  <span><kbd>Ctrl+Z</kbd> Undo</span>
                  <span><kbd>Ctrl+Y</kbd> Redo</span>
                  <span><kbd>Ctrl+K</kbd> Link</span>
                </div>
                <div class="ribbon-group-label">Keyboard Shortcuts</div>
              </div>
            }
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
                <button class="ribbon-btn vertical" [class.active]="showFormattingMarks" (click)="showFormattingMarks = !showFormattingMarks" matTooltip="Show paragraph marks and spaces (¶)">
                  <mat-icon>format_paragraph</mat-icon>
                  <span>¶ Marks</span>
                </button>
                <button class="ribbon-btn vertical" [class.active]="darkMode" (click)="darkMode = !darkMode" matTooltip="Dark mode">
                  <mat-icon>{{ darkMode ? 'light_mode' : 'dark_mode' }}</mat-icon>
                  <span>{{ darkMode ? 'Light' : 'Dark' }}</span>
                </button>
                <button class="ribbon-btn vertical" [class.active]="showNavPane" (click)="toggleNavPane()" matTooltip="Navigation pane — document headings">
                  <mat-icon>toc</mat-icon>
                  <span>Navigation</span>
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
          <div class="loading-page">
            <app-skeleton-rows [rows]="8" [avatar]="false"></app-skeleton-rows>
          </div>
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

      <!-- Find & Replace bar -->
      @if (showFindReplace) {
        <div class="find-bar">
          <mat-icon class="find-icon">search</mat-icon>
          <input class="find-input" type="text" placeholder="Find..." [(ngModel)]="findText" (ngModelChange)="runFind()" (keyup.enter)="findNext()" #findInput>
          <input class="find-input" type="text" placeholder="Replace with..." [(ngModel)]="replaceText">
          <label class="find-opt" matTooltip="Regular expression">
            <input type="checkbox" [(ngModel)]="findUseRegex" (ngModelChange)="runFind()"> .*
          </label>
          <label class="find-opt" matTooltip="Match case">
            <input type="checkbox" [(ngModel)]="findMatchCase" (ngModelChange)="runFind()"> Aa
          </label>
          <span class="find-count">{{ findMatches.length ? (currentMatchIndex + 1) + ' of ' + findMatches.length : (findText ? 'No matches' : '') }}</span>
          <button aria-label="Previous" mat-icon-button (click)="findPrev()" [disabled]="!findMatches.length" matTooltip="Previous"><mat-icon>keyboard_arrow_up</mat-icon></button>
          <button aria-label="Next" mat-icon-button (click)="findNext()" [disabled]="!findMatches.length" matTooltip="Next"><mat-icon>keyboard_arrow_down</mat-icon></button>
          <button mat-stroked-button (click)="replaceCurrent()" [disabled]="!findMatches.length">Replace</button>
          <button mat-stroked-button (click)="replaceAll()" [disabled]="!findMatches.length">Replace All</button>
          <button aria-label="Close" mat-icon-button (click)="toggleFindReplace()" matTooltip="Close"><mat-icon>close</mat-icon></button>
        </div>
      }

      <!-- Editor area -->
      <div class="editor-main">
        @if (showNavPane) {
          <div class="nav-pane" [class.dark-mode]="darkMode">
            <div class="nav-pane-header">
              <mat-icon>toc</mat-icon> Navigation
            </div>
            @if (docHeadings.length === 0) {
              <app-empty-state icon="toc" title="No headings yet" [compact]="true"
                               message="Use Heading styles to build the outline."></app-empty-state>
            } @else {
              @for (h of docHeadings; track h.pos) {
                <button class="nav-heading level-{{ h.level }}" (click)="goToHeading(h)">{{ h.text || '(empty heading)' }}</button>
              }
            }
          </div>
        }
        <div class="editor-wrapper" [style.zoom]="zoomLevel / 100" [class.dark-mode]="darkMode" [class.show-marks]="showFormattingMarks">
          <div class="editor-page" [style.background]="darkMode ? null : pageColor" [style.padding]="pageMargins" [style.width.px]="pageWidthPx" [style.minHeight.px]="pageHeightPx">
            <div #editorElement class="tiptap-editor"></div>
          </div>
        </div>
        @if (showComments) {
          <div class="comments-pane" [class.dark-mode]="darkMode">
            <div class="comments-pane-header">
              <mat-icon>comment</mat-icon> Comments
              <span class="spacer"></span>
              <button aria-label="Close" mat-icon-button (click)="showComments = false" matTooltip="Close"><mat-icon>close</mat-icon></button>
            </div>
            <div class="new-comment">
              <textarea [(ngModel)]="newCommentText" placeholder="Add a comment about the selected text..." rows="2"></textarea>
              <button mat-flat-button color="primary" [disabled]="!newCommentText.trim()" (click)="submitComment()">
                <mat-icon>send</mat-icon> Post
              </button>
            </div>
            @if (comments.length === 0) {
              <app-empty-state icon="comment" title="No comments yet" [compact]="true"
                               message="Select text and click Comment, or type above."></app-empty-state>
            }
            @for (c of comments; track c.id) {
              <div class="comment-card" (click)="goToComment(c)">
                <div class="comment-head">
                  <div class="comment-avatar" [style.background]="c.color">{{ c.author.charAt(0).toUpperCase() }}</div>
                  <div class="comment-meta">
                    <div class="comment-author">{{ c.author }}</div>
                    <div class="comment-date">{{ c.createdAt | date:'MMM d, h:mm a' }}</div>
                  </div>
                  <button aria-label="Delete comment" mat-icon-button class="comment-delete" (click)="deleteComment(c, $event)" matTooltip="Delete comment"><mat-icon>delete_outline</mat-icon></button>
                </div>
                @if (c.quote) {
                  <div class="comment-quote">“{{ c.quote }}”</div>
                }
                <div class="comment-text">{{ c.text }}</div>
              </div>
            }
          </div>
        }
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
              <button aria-label="Close" mat-icon-button (click)="showWellyPanel = false">
                <mat-icon>close</mat-icon>
              </button>
            </div>
            <div class="welly-panel-body">
              @if (wellyLoading) {
                <div class="welly-loading">
                  <p>Welly is {{ wellyActionLabel }}...</p>
                  <app-skeleton-rows [rows]="4" [avatar]="false"></app-skeleton-rows>
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
              <button aria-label="Close" mat-icon-button (click)="showEmailDialog = false">
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
            <button aria-label="Zoom out" mat-icon-button (click)="zoomOut()" [disabled]="zoomLevel <= 50">
              <mat-icon>remove</mat-icon>
            </button>
            <span>{{ zoomLevel }}%</span>
            <button aria-label="Zoom in" mat-icon-button (click)="zoomIn()" [disabled]="zoomLevel >= 200">
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
      background: var(--color-surface-2);
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
      background: var(--color-surface);
      border-bottom: 1px solid var(--color-line);
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
      color: var(--color-primary);
    }

    .document-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .title-input {
      border: none;
      font-size: var(--text-xl);
      font-weight: 500;
      padding: 4px 8px;
      border-radius: 4px;
      background: transparent;
      color: var(--color-text);
      min-width: 200px;
    }

    .title-input:hover,
    .title-input:focus {
      background: var(--color-primary-soft);
      outline: none;
    }

    .menu-bar {
      display: flex;
      gap: 0;
    }

    .menu-bar button {
      font-size: var(--text-sm);
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
      font-size: var(--text-xs);
      color: var(--color-text-2);
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
      color: var(--color-on-dark);
      font-weight: 600;
      font-size: var(--text-md);
      border: 2px solid var(--color-surface);
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
      color: var(--color-ok);
    }

    .connection-status.Reconnecting {
      color: var(--color-warn);
    }

    .connection-status.Disconnected,
    .connection-status.Error {
      color: var(--color-danger);
    }

    /* Ribbon */
    .ribbon {
      background: var(--color-surface);
      border-bottom: 1px solid var(--color-line);
    }

    .ribbon-tabs {
      display: flex;
      padding: 0 16px;
      border-bottom: 1px solid var(--color-line);
      background: var(--color-surface);
    }

    .ribbon-tab {
      padding: 8px 16px;
      border: none;
      background: none;
      cursor: pointer;
      font-size: var(--text-sm);
      color: var(--color-text-2);
      border-bottom: 3px solid transparent;
      transition: all 0.2s;
    }

    .ribbon-tab:hover {
      background: var(--color-surface-2);
    }

    .ribbon-tab.active {
      color: var(--color-primary);
      border-bottom-color: var(--color-primary);
    }

    .ribbon-tab.file-tab {
      background: var(--color-primary);
      color: var(--color-on-primary);
      border-radius: 4px 4px 0 0;
      margin-right: 4px;
      font-weight: 600;
    }

    .ribbon-tab.file-tab:hover { background: var(--color-primary-hover); }

    .draw-pen {
      width: 28px;
      height: 36px;
      border: 2px solid var(--color-line);
      border-radius: 4px 4px 12px 12px;
      cursor: pointer;
      margin: 0 2px;
      transition: transform 0.15s, border-color 0.15s;
    }
    .draw-pen:hover { transform: translateY(-3px); }
    .draw-pen.active { border-color: var(--color-primary); transform: translateY(-3px); box-shadow: var(--shadow-md); }

    .theme-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      padding: 6px 12px;
      border: 1px solid transparent;
      border-radius: var(--radius-sm);
      background: none;
      color: var(--color-text);
      cursor: pointer;
    }
    .theme-btn:hover { background: var(--color-surface-2); }
    .theme-btn.active { border-color: var(--color-primary); background: var(--color-primary-soft); }
    .theme-preview { font-size: var(--text-2xl); font-weight: 700; line-height: 1; }
    .theme-name { font-size: var(--text-xs); color: var(--color-text-2); }

    .word-count-panel {
      font-size: var(--text-xs);
      color: var(--color-text);
      padding: 4px 10px;
      line-height: 1.6;
    }

    .shortcuts-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 16px;
      font-size: var(--text-xs);
      color: var(--color-text);
      align-items: center;
    }
    .shortcuts-list kbd {
      background: var(--color-surface-2);
      border: 1px solid var(--color-line);
      border-radius: 4px;
      padding: 1px 6px;
      font-family: inherit;
      font-size: var(--text-xs);
    }

    .menu-active { font-weight: 700; color: var(--color-primary); }

    /* Word-web top bar */
    .topbar-btn {
      font-size: var(--text-sm);
      color: var(--color-text-2);
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .topbar-btn.active { color: var(--color-primary); background: var(--color-primary-soft); }
    .topbar-btn .dropdown-caret { margin: 0 -6px 0 -2px; }
    .comment-count {
      background: var(--color-primary);
      color: var(--color-on-primary);
      border-radius: 10px;
      font-size: var(--text-xs);
      padding: 0 6px;
      margin-left: 2px;
    }
    .dictating-mic { color: var(--color-danger); animation: livePulseMic 1.2s infinite; }
    @keyframes livePulseMic { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }

    /* Comments pane */
    .comments-pane {
      width: 300px;
      flex-shrink: 0;
      background: var(--color-surface-2);
      border-left: 1px solid var(--color-line);
      color: var(--color-text);
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .comments-pane.dark-mode, .nav-pane.dark-mode {
      --color-surface: #2d2f34;
      --color-text: #e8eaed;
      --color-text-2: #9aa0a6;
      --color-text-3: #9aa0a6;
      --color-line: #3c3f45;
    }
    .comments-pane.dark-mode { background: #26282c; border-left-color: #3c3f45; color: #e8eaed; }
    .comments-pane-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      font-size: var(--text-md);
    }
    .comments-pane-header .spacer { flex: 1; }
    .new-comment { display: flex; flex-direction: column; gap: 6px; }
    .new-comment textarea {
      width: 100%;
      border: 1px solid var(--color-line);
      border-radius: 6px;
      padding: 8px;
      font-family: inherit;
      font-size: var(--text-sm);
      background: var(--color-surface);
      color: var(--color-text);
      resize: vertical;
      box-sizing: border-box;
    }
    .comment-card {
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: 8px;
      padding: 10px;
      cursor: pointer;
      box-shadow: var(--shadow-sm);
    }
    .comments-pane.dark-mode .comment-card { background: #2d2f34; border-color: #3c3f45; }
    .comment-card:hover { border-color: var(--color-primary); }
    .comment-head { display: flex; align-items: center; gap: 8px; }
    .comment-avatar {
      width: 28px; height: 28px; border-radius: 50%;
      color: var(--color-on-dark); display: flex; align-items: center; justify-content: center;
      font-size: var(--text-sm); font-weight: 600; flex-shrink: 0;
    }
    .comment-meta { flex: 1; min-width: 0; }
    .comment-author { font-size: var(--text-sm); font-weight: 600; }
    .comment-date { font-size: var(--text-xs); color: var(--color-text-3); }
    .comment-delete { opacity: 0.4; }
    .comment-card:hover .comment-delete { opacity: 1; }
    .comment-quote {
      font-size: var(--text-xs);
      color: var(--color-text-2);
      border-left: 3px solid var(--color-cat-amber);
      padding-left: 8px;
      margin: 6px 0;
      font-style: italic;
    }
    .comments-pane.dark-mode .comment-quote { color: #9aa0a6; }
    .comment-text { font-size: var(--text-sm); margin-top: 4px; white-space: pre-wrap; }

    .ribbon-content {
      display: flex;
      align-items: flex-start;
      padding: 8px 16px;
      gap: 4px;
      background: var(--color-surface);
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
      font-size: var(--text-xs);
      color: var(--color-text-2);
      text-align: center;
      padding-top: 4px;
      border-top: 1px solid var(--color-line);
      margin-top: 4px;
    }

    .ribbon-separator {
      width: 1px;
      background: var(--color-line);
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
      color: var(--color-text-2);
      transition: all 0.15s;
      gap: 2px;
    }

    .ribbon-btn:hover {
      background: var(--color-surface-2);
      color: var(--color-primary);
    }

    .ribbon-btn.active {
      background: var(--color-primary-soft);
      color: var(--color-primary);
    }

    .ribbon-btn mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .ribbon-btn span {
      font-size: var(--text-xs);
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
      border: 1px solid var(--color-line);
      border-radius: 4px;
      font-size: var(--text-xs);
      background: var(--color-surface);
      color: var(--color-text);
    }

    .font-size-select {
      width: 50px;
      padding: 4px;
      border: 1px solid var(--color-line);
      border-radius: 4px;
      font-size: var(--text-xs);
      background: var(--color-surface);
      color: var(--color-text);
    }

    .size-select {
      width: 56px;
      padding: 4px 6px;
      border: 1px solid var(--color-line);
      border-radius: 4px;
      font-size: var(--text-xs);
      background: var(--color-surface);
      color: var(--color-text);
    }

    .color-palette {
      display: grid;
      grid-template-columns: repeat(8, 22px);
      gap: 4px;
      padding: 10px;
    }

    .color-swatch {
      width: 22px;
      height: 22px;
      border: 1px solid var(--color-line-strong);
      border-radius: 3px;
      cursor: pointer;
      padding: 0;
    }

    .color-swatch:hover {
      transform: scale(1.15);
      box-shadow: var(--shadow-sm);
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
      color: var(--color-text-2);
      position: relative;
    }

    .ribbon-icon-btn:hover {
      background: var(--color-surface-2);
      color: var(--color-primary);
    }

    .ribbon-icon-btn.active {
      background: var(--color-primary-soft);
      color: var(--color-primary);
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
      border: 1px solid var(--color-line);
      background: var(--color-surface);
      color: var(--color-text);
      cursor: pointer;
      border-radius: 4px;
      min-width: 70px;
      text-align: left;
    }

    .style-btn:hover {
      border-color: var(--color-primary);
    }

    .style-btn.active {
      border-color: var(--color-primary);
      background: var(--color-primary-soft);
    }

    .style-preview {
      display: block;
      line-height: 1.2;
    }

    .style-preview.normal {
      font-size: var(--text-xs);
    }

    .style-preview.h1 {
      font-size: var(--text-md);
      font-weight: 700;
      color: var(--color-text);
    }

    .style-preview.h2 {
      font-size: var(--text-xs);
      font-weight: 600;
      color: var(--color-text);
    }

    .style-preview.h3 {
      font-size: var(--text-xs);
      font-weight: 600;
      color: var(--color-text-2);
    }

    .style-preview.title-style {
      font-size: var(--text-md);
      font-weight: 700;
      font-family: Georgia, 'Times New Roman', serif;
      color: var(--color-brand);
    }

    .style-preview.quote-style {
      font-size: var(--text-xs);
      font-style: italic;
      color: var(--color-text-2);
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
      font-size: var(--text-xs);
      color: var(--color-text-2);
      min-width: 40px;
      text-align: center;
    }

    /* Table Grid */
    .table-grid {
      padding: 8px;
    }

    .table-size-label {
      font-size: var(--text-xs);
      color: var(--color-text-2);
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
      border: 1px solid var(--color-line);
      background: var(--color-surface);
      cursor: pointer;
    }

    .table-grid-cell.selected {
      background: var(--color-primary-soft);
      border-color: var(--color-primary);
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
      border: 1px solid var(--color-line);
      border-radius: 4px;
      cursor: pointer;
    }

    .color-swatch:hover {
      transform: scale(1.1);
      box-shadow: var(--shadow-sm);
    }

    /* Ruler */
    .ruler {
      display: flex;
      background: var(--color-surface);
      border-bottom: 1px solid var(--color-line);
      padding: 4px 0;
      justify-content: center;
    }

    .ruler-mark {
      width: 8px;
      height: 8px;
      border-left: 1px solid var(--color-line);
      font-size: 8px;
      color: var(--color-text-2);
    }

    .ruler-mark.major {
      height: 16px;
      border-left-color: var(--color-text-3);
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
      background: color-mix(in srgb, var(--color-surface-2) 92%, transparent);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }

    .loading-page {
      width: min(816px, 90%);
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-sm);
      padding: var(--space-5) var(--space-4);
    }

    .loading-overlay p {
      margin-top: 16px;
      color: var(--color-text-2);
    }

    .ocr-overlay {
      background: color-mix(in srgb, var(--color-surface) 95%, transparent);
      gap: 8px;
    }

    .ocr-scan-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: var(--color-primary);
      animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.7; transform: scale(1.05); }
    }

    .ocr-overlay .ocr-status {
      font-size: var(--text-md);
      color: var(--color-text);
      font-weight: 500;
      margin: 4px 0;
    }

    .ocr-progress-bar {
      width: 250px;
      height: 6px;
      background: var(--color-line);
      border-radius: 3px;
      overflow: hidden;
    }

    .ocr-progress-fill {
      height: 100%;
      background: var(--color-primary);
      border-radius: 3px;
      transition: width 0.3s ease;
    }

    .ocr-progress-text {
      font-size: var(--text-xs);
      color: var(--color-text-2);
    }

    /* Editor main: nav pane + page */
    .editor-main {
      flex: 1;
      display: flex;
      min-height: 0;
      overflow: hidden;
    }

    .nav-pane {
      width: 240px;
      flex-shrink: 0;
      overflow-y: auto;
      background: var(--color-surface);
      border-right: 1px solid var(--color-line);
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .nav-pane.dark-mode {
      background: #2b2d31;
      border-right-color: #3c3f45;
    }

    .nav-pane-header {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--color-text-2);
      padding: 6px 8px;
      border-bottom: 1px solid var(--color-line);
      margin-bottom: 4px;
    }

    .nav-pane.dark-mode .nav-pane-header { color: #9aa0a6; border-bottom-color: #3c3f45; }

    .nav-pane-header mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .nav-heading {
      display: block;
      width: 100%;
      text-align: left;
      border: none;
      background: none;
      cursor: pointer;
      padding: 5px 8px;
      border-radius: 4px;
      font-size: var(--text-sm);
      color: var(--color-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .nav-pane.dark-mode .nav-heading { color: #e8eaed; }

    .nav-heading:hover { background: var(--color-primary-soft); color: var(--color-primary); }
    .nav-heading.level-1 { font-weight: 700; }
    .nav-heading.level-2 { padding-left: 20px; font-weight: 500; }
    .nav-heading.level-3 { padding-left: 34px; color: var(--color-text-2); }

    /* Find & Replace bar */
    .find-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 16px;
      background: var(--color-surface-2);
      border-bottom: 1px solid var(--color-line);
      flex-wrap: wrap;
    }

    .find-icon { color: var(--color-text-2); }

    .find-input {
      padding: 5px 10px;
      border: 1px solid var(--color-line);
      border-radius: 4px;
      font-size: var(--text-sm);
      width: 180px;
      background: var(--color-surface);
      color: var(--color-text);
    }

    .find-opt {
      display: flex;
      align-items: center;
      gap: 3px;
      font-size: var(--text-xs);
      font-weight: 600;
      color: var(--color-text-2);
      cursor: pointer;
      user-select: none;
    }

    .find-count {
      font-size: var(--text-xs);
      color: var(--color-text-2);
      min-width: 70px;
    }

    /* Editor Wrapper */
    .editor-wrapper {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
      display: flex;
      justify-content: center;
      background: var(--color-surface-2);
      transition: background 0.25s ease;
    }

    /* — Dark mode (WordCraft-style) — */
    .editor-wrapper.dark-mode {
      background: #1e1f22;
    }

    .editor-wrapper.dark-mode .editor-page {
      background: #2b2d31;
      box-shadow: 0 1px 4px rgba(0,0,0,0.6);
    }

    .editor-wrapper.dark-mode :is(.tiptap-editor, .tiptap-editor p, .tiptap-editor li,
      .tiptap-editor h1, .tiptap-editor h2, .tiptap-editor h3) {
      color: #e8eaed;
    }

    .editor-wrapper.dark-mode .tiptap-editor blockquote {
      background: #35373c;
      color: #e8eaed;
    }

    .editor-wrapper.dark-mode .tiptap-editor pre,
    .editor-wrapper.dark-mode .tiptap-editor code {
      background: #1e1f22;
      color: #e8eaed;
    }

    /* — Formatting marks (¶ and space dots) — */
    .editor-wrapper.show-marks .tiptap-editor p::after,
    .editor-wrapper.show-marks .tiptap-editor h1::after,
    .editor-wrapper.show-marks .tiptap-editor h2::after,
    .editor-wrapper.show-marks .tiptap-editor h3::after {
      content: '¶';
      color: #9aa0a6;
      opacity: 0.7;
      margin-left: 2px;
      font-weight: 400;
      font-size: 0.9em;
    }

    .editor-page {
      width: 100%;
      max-width: 816px;
      min-height: calc(100vh - 280px);
      background: var(--color-surface);
      box-shadow: var(--shadow-md);
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
      background: var(--color-surface);
      border-top: 1px solid var(--color-line);
      font-size: var(--text-xs);
      color: var(--color-text-2);
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
      color: var(--color-text);
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
      background: var(--color-surface-2);
      font-style: italic;
    }

    :host ::ng-deep .tiptap-editor pre {
      background: var(--color-surface-2);
      color: var(--color-text);
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
      background: var(--color-surface-2);
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
      border-top: 1px solid var(--color-line);
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
      border: 1px solid var(--color-line);
      padding: 8px 12px;
      text-align: left;
    }

    :host ::ng-deep .tiptap-editor th {
      background: var(--color-surface-2);
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
      color: var(--color-on-dark);
      font-size: var(--text-xs);
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
      background: var(--color-primary);
      color: var(--color-on-primary);
      border-radius: var(--radius-control);
      transition: all 0.3s ease;
    }

    .welly-group .welly-btn:hover {
      background: var(--color-primary-hover);
      color: var(--color-on-primary);
      box-shadow: var(--shadow-md);
    }

    .welly-panel-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--color-scrim);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .welly-panel {
      background: var(--color-surface);
      color: var(--color-text);
      border-radius: var(--radius-lg);
      width: 560px;
      max-width: 90vw;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      box-shadow: var(--shadow-lg);
      overflow: hidden;
    }

    .welly-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      background: var(--color-surface);
      color: var(--color-text);
      border-bottom: 1px solid var(--color-line);
    }

    .welly-panel-title {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .welly-panel-title h3 {
      margin: 0;
      font-size: var(--text-lg);
      font-weight: 600;
    }

    .welly-sparkle {
      color: var(--color-primary);
    }

    .welly-panel-body {
      padding: 24px;
      overflow-y: auto;
      max-height: 60vh;
    }

    .welly-loading {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .welly-loading p {
      margin: 0;
      color: var(--color-text-2);
      font-size: var(--text-md);
    }

    .welly-result-text {
      background: var(--color-canvas);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-md);
      padding: 16px;
      font-size: var(--text-md);
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
      color: var(--color-text-2);
      font-size: var(--text-md);
    }

    .welly-generate-form textarea {
      width: 100%;
      border: 1px solid var(--color-line);
      border-radius: var(--radius-control);
      padding: 12px;
      font-size: var(--text-md);
      background: var(--color-surface);
      color: var(--color-text);
      font-family: inherit;
      resize: vertical;
      outline: none;
      transition: border-color 0.2s;
    }

    .welly-generate-form textarea:focus {
      border-color: var(--color-primary);
    }

    /* Email Dialog */
    .email-dialog {
      background: var(--color-surface);
      color: var(--color-text);
      border-radius: var(--radius-lg);
      width: 620px;
      max-width: 92vw;
      max-height: 88vh;
      display: flex;
      flex-direction: column;
      box-shadow: var(--shadow-lg);
      overflow: hidden;
    }

    .email-dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      background: var(--color-surface);
      color: var(--color-text);
      border-bottom: 1px solid var(--color-line);
    }

    .email-dialog-title mat-icon {
      color: var(--color-primary);
    }

    .email-dialog-title {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .email-dialog-title h3 {
      margin: 0;
      font-size: var(--text-lg);
      font-weight: 600;
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
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--color-text-2);
      margin-bottom: 6px;
    }

    .email-field .required {
      color: var(--color-danger);
    }

    .email-input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--color-line);
      border-radius: var(--radius-control);
      font-size: var(--text-md);
      background: var(--color-surface);
      color: var(--color-text);
      font-family: inherit;
      outline: none;
      transition: border-color 0.2s;
      box-sizing: border-box;
    }

    .email-input:focus {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 2px var(--color-primary-soft);
    }

    .email-textarea-wrapper {
      position: relative;
    }

    .email-textarea {
      width: 100%;
      padding: 10px 12px;
      padding-bottom: 44px;
      border: 1px solid var(--color-line);
      border-radius: var(--radius-control);
      font-size: var(--text-md);
      background: var(--color-surface);
      color: var(--color-text);
      font-family: inherit;
      resize: vertical;
      outline: none;
      transition: border-color 0.2s;
      box-sizing: border-box;
      min-height: 100px;
    }

    .email-textarea:focus {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 2px var(--color-primary-soft);
    }

    .welly-compose-btn {
      position: absolute;
      bottom: 8px;
      right: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      border: 1px solid transparent;
      border-radius: 20px;
      background: var(--color-primary);
      color: var(--color-on-primary);
      font-size: var(--text-xs);
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .welly-compose-btn:hover:not(:disabled) {
      background: var(--color-primary-hover);
      box-shadow: var(--shadow-md);
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
      color: inherit;
    }

    .email-options {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 12px 16px;
      background: var(--color-canvas);
      border-radius: var(--radius-control);
      margin-top: 4px;
    }

    .email-checkbox {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-size: var(--text-sm);
      color: var(--color-text-2);
    }

    .email-checkbox input[type="checkbox"] {
      width: 16px;
      height: 16px;
      accent-color: var(--color-primary);
      cursor: pointer;
    }

    .email-checkbox mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: var(--color-text-3);
    }

    .email-dialog-footer {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      border-top: 1px solid var(--color-line);
      background: var(--color-canvas);
    }

    .email-dialog-footer button[mat-raised-button] {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .btn-spinner {
      display: inline-block;
    }

    .ribbon-btn.email-btn {
      background: var(--color-primary);
      color: var(--color-on-primary);
      border-radius: var(--radius-sm);
    }

    .ribbon-btn.email-btn:hover {
      background: var(--color-primary-hover);
      color: var(--color-on-primary);
      box-shadow: var(--shadow-md);
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

  // Design / Layout state
  pageColor = '#ffffff';
  pageColors = ['#ffffff', '#fdf6e3', '#fff8f0', '#f0f7ff', '#f3fff0', '#fff0f5', '#f5f0ff', '#f7f7f7', '#1e1e1e'];
  activeTheme = 'Office';
  docThemes: Array<{ name: string; font: string; accent: string }> = [
    { name: 'Office', font: 'Calibri', accent: '#2b579a' },
    { name: 'Classic', font: 'Times New Roman', accent: '#000000' },
    { name: 'Modern', font: 'Helvetica', accent: '#d83b01' },
    { name: 'Elegant', font: 'Garamond', accent: '#5c2d91' },
    { name: 'Tech', font: 'Courier New', accent: '#107c10' },
  ];
  marginPreset: 'narrow' | 'normal' | 'wide' = 'normal';
  pageOrientation: 'portrait' | 'landscape' = 'portrait';
  pageSize: 'a4' | 'letter' | 'legal' = 'a4';
  showShortcuts = false;
  private footnoteCounter = 0;

  // Word-web chrome: comments / editing mode / dictation
  showComments = false;
  comments: Array<{ id: number; author: string; color: string; text: string; quote: string; pos: number; createdAt: Date }> = [];
  newCommentText = '';
  private commentIdSeq = 1;
  editingMode: 'editing' | 'viewing' = 'editing';
  dictating = false;
  private speechRecognition: any = null;

  get pageMargins(): string {
    const m = { narrow: '48px 48px', normal: '96px 96px', wide: '96px 192px' }[this.marginPreset];
    return m;
  }
  get pageWidthPx(): number {
    const sizes = { a4: [794, 1123], letter: [816, 1056], legal: [816, 1346] } as const;
    const [w, h] = sizes[this.pageSize];
    return this.pageOrientation === 'portrait' ? w : h;
  }
  get pageHeightPx(): number {
    const sizes = { a4: [794, 1123], letter: [816, 1056], legal: [816, 1346] } as const;
    const [w, h] = sizes[this.pageSize];
    return this.pageOrientation === 'portrait' ? h : w;
  }

  // Font settings
  selectedFont = 'Arial';
  selectedFontSize = '11';
  fontFamilies = ['Arial', 'Calibri', 'Cambria', 'Courier New', 'Garamond', 'Georgia', 'Helvetica', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana'];
  fontSizes = ['8', '9', '10', '11', '12', '14', '16', '18', '20', '24', '28', '32', '36', '48', '72'];

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
  showFormattingMarks = false;
  darkMode = false;

  // Find & Replace
  showFindReplace = false;
  findText = '';
  replaceText = '';
  findUseRegex = false;
  findMatchCase = false;
  findMatches: Array<{ from: number; to: number }> = [];
  currentMatchIndex = 0;

  // Navigation pane
  showNavPane = false;
  docHeadings: Array<{ level: number; text: string; pos: number }> = [];
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
  private wellyActivityId: number | null = null;
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
    private toast: ToastService,
    private confirmDialog: ConfirmService,
    private http: HttpClient,
    private wellyActivity: WellyActivityService
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
        this.toast.error('Failed to load document');
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
        TextStyle,
        Color,
        FontFamily,
        FontSize,
        Subscript,
        Superscript,
        Link.configure({
          openOnClick: false,
          autolink: true,
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
        if (this.showNavPane) this.refreshHeadings();
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

    // If this doc was just created via the list-page Import button, seed its content.
    this.applyImportSeedIfAny();
  }

  /** Seed a freshly-created document from a file imported on the list page. */
  private applyImportSeedIfAny(): void {
    try {
      const key = `collab-import-doc-${this.documentId}`;
      const html = sessionStorage.getItem(key);
      if (!html) return;
      sessionStorage.removeItem(key);
      // Small delay so the collaboration binding is fully wired before we set content.
      setTimeout(() => {
        try {
          this.editor?.chain().focus().setContent(html).run();
          this.autosaveSubject.next();
          this.toast.done('Imported file content');
        } catch { /* ignore */ }
      }, 200);
    } catch { /* ignore malformed seed */ }
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
    this.editor?.chain().focus().toggleSubscript().run();
  }

  toggleSuperscript(): void {
    this.editor?.chain().focus().toggleSuperscript().run();
  }

  setFont(): void {
    this.editor?.chain().focus().setFontFamily(this.selectedFont).run();
  }

  setFontSize(): void {
    (this.editor?.chain().focus() as any).setFontSize(`${this.selectedFontSize}pt`).run();
  }

  setTextColor(color: string): void {
    this.selectedTextColor = color;
    this.editor?.chain().focus().setColor(color).run();
  }

  unsetTextColor(): void {
    this.editor?.chain().focus().unsetColor().run();
  }

  setHighlightColor(color: string): void {
    this.selectedHighlightColor = color;
    this.editor?.chain().focus().toggleHighlight({ color }).run();
  }

  toggleHighlight(): void {
    this.editor?.chain().focus().toggleHighlight({ color: this.selectedHighlightColor }).run();
  }

  // ---- Draw tab ----
  setHighlight(color: string): void {
    this.selectedHighlightColor = color;
    this.editor?.chain().focus().setHighlight({ color }).run();
  }

  removeHighlight(): void {
    this.editor?.chain().focus().unsetHighlight().run();
  }

  // ---- Design tab ----
  applyTheme(t: { name: string; font: string; accent: string }): void {
    this.activeTheme = t.name;
    this.selectedFont = t.font;
    this.editor?.chain().focus().selectAll().setFontFamily(t.font).run();
    this.editor?.commands.setTextSelection(this.editor.state.selection.to);
    this.toast.done(`Theme "${t.name}" applied`);
  }

  // ---- Layout tab ----
  setMargins(preset: 'narrow' | 'normal' | 'wide'): void {
    this.marginPreset = preset;
  }

  toggleOrientation(): void {
    this.pageOrientation = this.pageOrientation === 'portrait' ? 'landscape' : 'portrait';
  }

  // ---- Word-web chrome ----
  toggleComments(): void {
    this.showComments = !this.showComments;
  }

  addComment(): void {
    this.showComments = true;
    const { from, to } = this.editor?.state.selection ?? { from: 0, to: 0 };
    if (from !== to) {
      // pre-fill quote via submitComment
    }
    setTimeout(() => (document.querySelector('.new-comment textarea') as HTMLTextAreaElement)?.focus(), 100);
  }

  submitComment(): void {
    const text = this.newCommentText.trim();
    if (!text) return;
    const sel = this.editor?.state.selection;
    let quote = '';
    let pos = 0;
    if (sel && sel.from !== sel.to) {
      quote = this.editor!.state.doc.textBetween(sel.from, sel.to, ' ').slice(0, 120);
      pos = sel.from;
    }
    this.comments.unshift({
      id: this.commentIdSeq++,
      author: this.currentUserName || 'Me',
      color: this.currentUserColor || '#2b579a',
      text,
      quote,
      pos,
      createdAt: new Date(),
    });
    this.newCommentText = '';
  }

  deleteComment(c: { id: number }, ev: Event): void {
    ev.stopPropagation();
    this.comments = this.comments.filter(x => x.id !== c.id);
  }

  goToComment(c: { pos: number }): void {
    if (!c.pos || !this.editor) return;
    this.editor.chain().focus().setTextSelection(Math.min(c.pos, this.editor.state.doc.content.size)).scrollIntoView().run();
  }

  setEditingMode(mode: 'editing' | 'viewing'): void {
    this.editingMode = mode;
    this.editor?.setEditable(mode === 'editing');
    this.toast.info(mode === 'editing' ? 'Editing mode — you can make changes' : 'Viewing mode — read only');
  }

  shareDocument(): void {
    navigator.clipboard.writeText(window.location.href).then(() => {
      this.toast.done('Link copied to clipboard — share it with your team');
    });
  }

  openFind(withReplace: boolean): void {
    this.showFindReplace = true;
    setTimeout(() => {
      const inputs = document.querySelectorAll('.find-bar .find-input');
      ((withReplace ? inputs[1] : inputs[0]) as HTMLInputElement)?.focus();
    }, 100);
  }

  toggleDictation(): void {
    if (this.dictating) {
      this.speechRecognition?.stop();
      this.dictating = false;
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      this.toast.warn('Dictation is not supported in this browser. Try Chrome or Edge.');
      return;
    }
    this.speechRecognition = new SR();
    this.speechRecognition.continuous = true;
    this.speechRecognition.interimResults = false;
    this.speechRecognition.lang = 'en-ZA';
    this.speechRecognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const transcript = event.results[i][0].transcript;
          this.editor?.chain().focus().insertContent(transcript + ' ').run();
        }
      }
    };
    this.speechRecognition.onerror = () => { this.dictating = false; };
    this.speechRecognition.onend = () => {
      if (this.dictating) this.speechRecognition.start(); // keep listening until user stops
    };
    this.speechRecognition.start();
    this.dictating = true;
    this.toast.info('Dictation started — speak now. Click Stop when done.');
  }

  // ---- References tab ----
  insertTableOfContents(): void {
    this.refreshHeadings();
    if (!this.docHeadings.length) {
      this.toast.warn('No headings found. Apply Heading styles first.');
      return;
    }
    const items = this.docHeadings
      .map(h => `<p style="margin:2px 0; padding-left:${(h.level - 1) * 24}px;">${h.text || '(untitled)'}</p>`)
      .join('');
    const toc = `<h2>Table of Contents</h2>${items}<hr>`;
    this.editor?.chain().focus().setTextSelection(0).insertContent(toc).run();
  }

  async insertFootnote(): Promise<void> {
    this.footnoteCounter++;
    const n = this.footnoteCounter;
    const note = await this.confirmDialog.askText({
      title: `Add footnote ${n}`,
      label: 'Footnote text',
      confirmText: 'Insert footnote'
    });
    if (note === null) { this.footnoteCounter--; return; }
    this.editor?.chain().focus().insertContent(`<sup>[${n}]</sup>`).run();
    const endPos = this.editor?.state.doc.content.size ?? 0;
    this.editor?.chain().setTextSelection(endPos).insertContent(`<p><sup>[${n}]</sup> ${note}</p>`).run();
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
      this.toast.warn('Unable to paste. Please use Ctrl+V');
    });
  }

  selectAll(): void {
    this.editor?.chain().focus().selectAll().run();
  }

  // Table operations (not available without Table extension)
  insertTable(): void {
    this.toast.info('Tables not available');
  }

  // Image operations (not available without Image extension)
  triggerImageUpload(): void {
    this.toast.info('Image upload not available');
  }

  insertImage(event: Event): void {
    this.toast.info('Image insert not available');
  }

  // Link operations
  async insertLink(): Promise<void> {
    if (this.editor?.isActive('link')) {
      this.editor.chain().focus().unsetLink().run();
      return;
    }
    const previous = this.editor?.getAttributes('link')?.['href'] || '';
    const url = await this.confirmDialog.askText({
      title: 'Insert link',
      label: 'Link URL',
      value: previous,
      placeholder: 'https://',
      hint: 'Leave empty to remove the link',
      confirmText: 'Insert link'
    });
    if (url === null) return;
    if (url === '') {
      this.editor?.chain().focus().unsetLink().run();
    } else {
      const href = /^(https?:\/\/|mailto:)/i.test(url) ? url : `https://${url}`;
      this.editor?.chain().focus().extendMarkRange('link').setLink({ href }).run();
    }
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

  /** Export as a Word-compatible .doc (Word HTML format — opens directly in Word). */
  exportAsWord(): void {
    if (!this.editor) return;
    const body = this.editor.getHTML();
    const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${this.documentTitle || 'Document'}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.4; }
  h1 { font-size: 20pt; } h2 { font-size: 16pt; } h3 { font-size: 13pt; }
  blockquote { border-left: 3pt solid #1a73e8; margin-left: 0; padding-left: 12pt; font-style: italic; }
  table { border-collapse: collapse; } td, th { border: 1pt solid #999; padding: 4pt 8pt; }
  mark { background: yellow; }
</style></head><body>${body}</body></html>`;
    const blob = new Blob(['\ufeff', doc], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (this.documentTitle || 'document') + '.doc';
    a.click();
    URL.revokeObjectURL(url);
    this.toast.done('Exported as Word document');
  }

  /** Word-style Title: an H1 with larger size via textStyle. */
  applyTitleStyle(): void {
    this.editor?.chain().focus().setHeading({ level: 1 }).run();
    (this.editor?.chain().focus() as any).setFontSize('28pt').run();
  }

  // —— Find & Replace ——
  toggleFindReplace(): void {
    this.showFindReplace = !this.showFindReplace;
    if (!this.showFindReplace) {
      this.findMatches = [];
    } else {
      this.runFind();
    }
  }

  /** Collect text segments with ProseMirror positions, then match. */
  runFind(): void {
    this.findMatches = [];
    this.currentMatchIndex = 0;
    if (!this.editor || !this.findText) return;

    let regex: RegExp;
    try {
      const flags = this.findMatchCase ? 'g' : 'gi';
      const pattern = this.findUseRegex
        ? this.findText
        : this.findText.replace(/[.*+?^$\{\}()|\[\]\\]/g, '\\$&');
      regex = new RegExp(pattern, flags);
    } catch {
      return; // invalid regex while typing — just wait
    }

    const matches: Array<{ from: number; to: number }> = [];
    this.editor.state.doc.descendants((node: any, pos: number) => {
      if (!node.isText || !node.text) return;
      let m: RegExpExecArray | null;
      regex.lastIndex = 0;
      while ((m = regex.exec(node.text)) !== null) {
        if (m[0].length === 0) { regex.lastIndex++; continue; }
        matches.push({ from: pos + m.index, to: pos + m.index + m[0].length });
      }
    });
    this.findMatches = matches;
    if (matches.length) this.highlightMatch(0);
  }

  private highlightMatch(index: number): void {
    if (!this.editor || !this.findMatches.length) return;
    this.currentMatchIndex = ((index % this.findMatches.length) + this.findMatches.length) % this.findMatches.length;
    const m = this.findMatches[this.currentMatchIndex];
    this.editor.chain().focus().setTextSelection({ from: m.from, to: m.to }).scrollIntoView().run();
  }

  findNext(): void { this.highlightMatch(this.currentMatchIndex + 1); }
  findPrev(): void { this.highlightMatch(this.currentMatchIndex - 1); }

  replaceCurrent(): void {
    if (!this.editor || !this.findMatches.length) return;
    const m = this.findMatches[this.currentMatchIndex];
    this.editor.chain().focus().setTextSelection({ from: m.from, to: m.to })
      .insertContent(this.replaceText).run();
    const keepIndex = this.currentMatchIndex;
    this.runFind();
    if (this.findMatches.length) this.highlightMatch(Math.min(keepIndex, this.findMatches.length - 1));
  }

  replaceAll(): void {
    if (!this.editor || !this.findMatches.length) return;
    const count = this.findMatches.length;
    // Replace from last to first so earlier positions stay valid
    const chain = this.editor.chain().focus();
    [...this.findMatches].reverse().forEach(m => {
      chain.setTextSelection({ from: m.from, to: m.to }).insertContent(this.replaceText);
    });
    chain.run();
    this.runFind();
    this.toast.done(`Replaced ${count} occurrence${count === 1 ? '' : 's'}`);
  }

  // —— Navigation pane ——
  toggleNavPane(): void {
    this.showNavPane = !this.showNavPane;
    if (this.showNavPane) this.refreshHeadings();
  }

  refreshHeadings(): void {
    const headings: Array<{ level: number; text: string; pos: number }> = [];
    this.editor?.state.doc.descendants((node: any, pos: number) => {
      if (node.type.name === 'heading') {
        headings.push({ level: node.attrs['level'] || 1, text: node.textContent, pos });
      }
    });
    this.docHeadings = headings;
  }

  goToHeading(h: { pos: number }): void {
    this.editor?.chain().focus().setTextSelection(h.pos + 1).scrollIntoView().run();
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
      this.toast.warn('Please select a valid Word document (.docx)');
      return;
    }

    this.saving = true;
    this.toast.info('Importing Word document...');

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
        
        this.toast.done('Word document imported successfully');
        
        // Trigger autosave
        this.autosaveSubject.next();
      }
    } catch (error) {
      console.error('Error importing Word document:', error);
      this.toast.error('Failed to import Word document');
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
      this.toast.warn('Please select a valid PDF file (.pdf)');
      return;
    }

    this.saving = true;
    this.toast.info('Importing PDF document...');

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
        this.toast.done(`PDF imported successfully (${totalPages} page${totalPages > 1 ? 's' : ''})`);
        this.autosaveSubject.next();
      } else if (!htmlContent) {
        this.toast.warn('PDF appears to contain no extractable text (may be scanned/image-based)');
      }
    } catch (error) {
      console.error('Error importing PDF:', error);
      this.toast.error('Failed to import PDF document');
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
      this.toast.warn('Please select an image or PDF file');
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
        this.toast.error('Could not process the document');
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
        this.toast.warn('No text could be extracted from the scanned document');
        return;
      }

      // Send to Welly for cleanup and formatting
      this.ocrStatusMessage = 'Welly is cleaning up the extracted text...';
      this.ocrProgress = 0;

      const cleanedHtml = await this.wellyCleanupOcrText(fullText);

      if (this.editor && cleanedHtml) {
        this.editor.chain().focus().setContent(cleanedHtml).run();
        this.toast.done(`Scanned document imported (${totalPages} page${totalPages > 1 ? 's' : ''})`);
        this.autosaveSubject.next();
      }
    } catch (error) {
      console.error('Error scanning document:', error);
      this.toast.error('Failed to scan document. Please try again.');
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
    const composeActivityId = this.wellyActivity.start('Docs: Composing email');

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
        this.wellyActivity.stop(composeActivityId);
      },
      error: () => {
        this.toast.error('Welly could not compose the email. Please write it manually.');
        this.emailComposing = false;
        this.wellyActivity.stop(composeActivityId);
      }
    });
  }

  sendEmail(): void {
    if (!this.emailTo.trim()) {
      this.toast.warn('Please enter at least one recipient email address');
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
      this.toast.warn(`Invalid email address: ${invalidEmails[0]}`);
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
        this.toast.done('Email sent successfully');
        this.showEmailDialog = false;
        this.emailSending = false;
      },
      error: (err) => {
        console.error('Email send error:', err);
        const msg = err.error?.message || 'Failed to send email. Please try again.';
        this.toast.error(msg);
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
      this.toast.warn('Please write some text first, or select text to process');
      this.showWellyPanel = false;
      return;
    }

    this.wellyActionLabel = action === 'grammar' ? 'checking grammar' :
      action === 'summarize' ? 'summarizing' :
      action === 'rewrite' ? 'rewriting' :
      action === 'improve' ? 'improving' :
      action === 'translate' ? `translating to ${targetLanguage}` : 'processing';

    this.wellyLoading = true;
    this.wellyActivityId = this.wellyActivity.start(`Docs: ${this.wellyActionLabel}`);

    this.http.post<{ result: string }>(`${environment.apiUrl}/aichat/welly-assist`, {
      assistType: action,
      content: content,
      targetLanguage: targetLanguage
    }).subscribe({
      next: (res) => {
        this.wellyResult = res.result;
        this.wellyLoading = false;
        if (this.wellyActivityId !== null) { this.wellyActivity.stop(this.wellyActivityId); this.wellyActivityId = null; }
      },
      error: (err) => {
        console.error('Welly assist error:', err);
        this.toast.error('Welly could not process your request. Please try again.');
        this.wellyLoading = false;
        this.showWellyPanel = false;
        if (this.wellyActivityId !== null) { this.wellyActivity.stop(this.wellyActivityId); this.wellyActivityId = null; }
      }
    });
  }

  submitWellyGenerate(): void {
    if (!this.wellyGeneratePrompt.trim()) return;
    this.wellyLoading = true;
    this.wellyActionLabel = 'generating content';
    this.wellyActivityId = this.wellyActivity.start('Docs: Generating content');

    this.http.post<{ result: string }>(`${environment.apiUrl}/aichat/welly-assist`, {
      assistType: 'generate',
      content: this.wellyGeneratePrompt
    }).subscribe({
      next: (res) => {
        this.wellyResult = res.result;
        this.wellyLoading = false;
        if (this.wellyActivityId !== null) { this.wellyActivity.stop(this.wellyActivityId); this.wellyActivityId = null; }
      },
      error: (err) => {
        console.error('Welly generate error:', err);
        this.toast.error('Welly could not generate content. Please try again.');
        this.wellyLoading = false;
        if (this.wellyActivityId !== null) { this.wellyActivity.stop(this.wellyActivityId); this.wellyActivityId = null; }
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
    this.toast.done('Applied to document');
    this.showWellyPanel = false;
    this.autosaveSubject.next();
  }

  insertWellyResult(): void {
    if (!this.editor || !this.wellyResult) return;
    this.editor.chain().focus().insertContent(this.wellyResult).run();
    this.toast.done('Inserted into document');
    this.showWellyPanel = false;
    this.autosaveSubject.next();
  }

  copyWellyResult(): void {
    navigator.clipboard.writeText(this.wellyResult).then(() => {
      this.toast.done('Copied to clipboard');
    });
  }
}
