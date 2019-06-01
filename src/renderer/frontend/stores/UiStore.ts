import { action, observable, computed } from 'mobx';

import { ClientFile, IFile } from '../../entities/File';
import { ID } from '../../entities/ID';
import { ClientTag } from '../../entities/Tag';
import RootStore from './RootStore';
import { remote } from 'electron';

interface IHotkeyMap {
  // Outerliner actions
  toggleOutliner: string;
  openOutlinerImport: string;
  openOutlinerTags: string;
  openOutlinerSearch: string;

  // Inspector actions
  toggleInspector: string;
  toggleSettings: string;

  // Toolbar actions (these should only be active when the content area is focused)
  openTagSelector: string;
  deleteSelectedFiles: string;
  selectAllFiles: string;
  deselectAllFiles: string;
  viewList: string;
  viewGrid: string;
  viewMason: string;
  viewSlide: string;
}

const defaultHotkeyMap: IHotkeyMap = {
  toggleOutliner: '1',
  toggleInspector: '2',
  openOutlinerImport: 'shift + 1',
  openOutlinerTags: 'shift + 2',
  openOutlinerSearch: 'shift + 3',
  openTagSelector: 't',
  toggleSettings: 's',
  deleteSelectedFiles: 'del',
  selectAllFiles: 'mod + a',
  deselectAllFiles: 'mod + d',
  viewList: 'alt + 1',
  viewGrid: 'alt + 2',
  viewMason: 'alt + 3',
  viewSlide: 'alt + 4',
};

/**
 * From: https://mobx.js.org/best/store.html
 * Things you will typically find in UI stores:
 * - Session information
 * - Information about how far your application has loaded
 * - Information that will not be stored in the backend
 * - Information that affects the UI globally:
 *  - Window dimensions
 *  - Accessibility information
 *  - Current language
 *  - Currently active theme
 * - User interface state as soon as it affects multiple, further unrelated components:
 *  - Current selection
 *  - Visibility of toolbars, etc.
 *  - State of a wizard
 *  - State of a global overlay
 */

export type ViewMethod = 'list' | 'grid' | 'mason' | 'slide';

class UiStore {
  rootStore: RootStore;

  @observable isInitialized = false;

  // Theme
  @observable theme: 'LIGHT' | 'DARK' = 'DARK';

  // FullScreen
  @observable isFullScreen: boolean = false;

  // UI
  @observable outlinerPage: 'IMPORT' | 'TAGS' | 'SEARCH' = 'TAGS';
  @observable isOutlinerOpen: boolean = true;
  @observable isInspectorOpen: boolean = true;
  @observable isSettingsOpen: boolean = false;
  @observable isToolbarTagSelectorOpen: boolean = false;
  @observable isToolbarFileRemoverOpen: boolean = false;

  // VIEW
  @observable viewMethod: ViewMethod = 'grid';
  /** Index of the first item in the viewport */
  @observable firstIndexInView: number = 0;

  // Content
  @observable fileOrder: keyof IFile = 'dateAdded';
  @observable fileOrderDescending = true;
  @observable fileLayout: 'LIST' | 'GRID' | 'MASONRY' | 'SLIDE' = 'GRID';

  // Selections
  // Observable arrays recommended like this here https://github.com/mobxjs/mobx/issues/669#issuecomment-269119270
  readonly fileSelection = observable<ID>([]);
  readonly tagSelection = observable<ID>([]);

  @observable hotkeyMap: IHotkeyMap = defaultHotkeyMap;

  @computed get clientFileSelection(): ClientFile[] {
    return this.fileSelection.map((id) =>
      this.rootStore.fileStore.fileList.find((f) => f.id === id),
    ) as ClientFile[];
  }

  @computed get clientTagSelection(): ClientTag[] {
    return this.tagSelection.map((id) =>
      this.rootStore.tagStore.tagList.find((t) => t.id === id),
    ) as ClientTag[];
  }

  constructor(rootStore: RootStore) {
    this.rootStore = rootStore;
  }

  /////////////////// Selection actions ///////////////////
  @action selectFile(file: ClientFile) {
    this.fileSelection.push(file.id);
  }

  @action deselectFile(file: ClientFile) {
    this.fileSelection.remove(file.id);
  }

  @action clearFileSelection() {
    this.fileSelection.clear();
  }

  @action.bound selectAllFiles() {
    this.fileSelection.clear();
    this.fileSelection.push(
      ...this.rootStore.fileStore.fileList.map((f) => f.id),
    );
  }

  @action.bound deselectAllFiles() {
    this.fileSelection.clear();
  }

  @action selectTag(tag: ClientTag) {
    this.tagSelection.push(tag.id);
    this.cleanFileSelection();
    this.rootStore.fileStore.fetchFilesByTagIDs(this.tagSelection);
  }

  @action selectTags(tags: ClientTag[] | ID[]) {
    if (tags.length === 0) {
      return;
    }
    if (tags[0] instanceof ClientTag) {
      this.tagSelection.push(
        ...(tags as ClientTag[])
          .filter((t) => !this.tagSelection.includes(t.id))
          .map((tag: ClientTag) => tag.id));
    } else {
      this.tagSelection.push(
        ...(tags as ID[])
          .filter((t) => !this.tagSelection.includes(t)));
    }
    this.cleanFileSelection();
    this.rootStore.fileStore.fetchFilesByTagIDs(this.tagSelection);
  }

  @action deselectTags(tags: ClientTag[] | ID[]) {
    if (tags.length === 0) {
      return;
    }
    if (tags[0] instanceof ClientTag) {
      (tags as ClientTag[]).forEach((tag) => this.tagSelection.remove(tag.id));
    } else {
      (tags as ID[]).forEach((tag) => this.tagSelection.remove(tag));
    }
    this.cleanFileSelection();
    this.rootStore.fileStore.fetchFilesByTagIDs(this.tagSelection);
  }

  @action deselectTag(tag: ClientTag | ID) {
    this.tagSelection.remove(tag instanceof ClientTag ? tag.id : tag);
    this.cleanFileSelection();
    this.rootStore.fileStore.fetchFilesByTagIDs(this.tagSelection);
  }

  @action clearTagSelection() {
    this.tagSelection.clear();
    this.rootStore.fileStore.fetchFilesByTagIDs(this.tagSelection);
  }

  @action.bound setFileOrder(prop: keyof IFile) {
    this.fileOrder = prop;
    this.rootStore.fileStore.fetchFilesByTagIDs(this.tagSelection);
  }

  @action.bound setFileOrderDescending(descending: boolean) {
    this.fileOrderDescending = descending;
    this.rootStore.fileStore.fetchFilesByTagIDs(this.tagSelection);
  }

  /////////////////// UI Actions ///////////////////
  @action.bound toggleOutliner() {
    this.isOutlinerOpen = !this.isOutlinerOpen;
  }

  @action.bound openOutlinerImport() {
    this.outlinerPage = 'IMPORT';
  }
  @action.bound openOutlinerTags() {
    this.outlinerPage = 'TAGS';
  }
  @action.bound openOutlinerSearch() {
    this.outlinerPage = 'SEARCH';
  }

  // VIEW
  @action.bound viewList() {
    this.viewMethod = 'list';
  }
  @action.bound viewGrid() {
    this.viewMethod = 'grid';
  }
  @action.bound viewMason() {
    this.viewMethod = 'mason';
  }
  @action.bound viewSlide() {
    this.viewMethod = 'slide';
  }

  @action.bound setFirstIndexInView(index: number) {
    if (isFinite(index)) {
      this.firstIndexInView = index;
    }
  }

  @action.bound toggleInspector() {
    this.isInspectorOpen = !this.isInspectorOpen;
  }
  @action.bound toggleSettings() {
    this.isSettingsOpen = !this.isSettingsOpen;
  }
  @action.bound toggleTheme() {
    this.theme = this.theme === 'DARK' ? 'LIGHT' : 'DARK';
  }

  @action.bound toggleToolbarTagSelector() {
    this.isToolbarTagSelectorOpen =
      this.fileSelection.length > 0 && !this.isToolbarTagSelectorOpen;
  }
  @action.bound openToolbarTagSelector() {
    this.isToolbarTagSelectorOpen = this.fileSelection.length > 0;
  }
  @action.bound closeToolbarTagSelector() {
    this.isToolbarTagSelectorOpen = false;
  }

  @action.bound toggleToolbarFileRemover() {
    this.isToolbarFileRemoverOpen =
      this.fileSelection.length > 0 && !this.isToolbarFileRemoverOpen;
  }
  @action.bound openToolbarFileRemover() {
    this.isToolbarFileRemoverOpen = true;
  }
  @action.bound closeToolbarFileRemover() {
    this.isToolbarFileRemoverOpen = false;
  }

  @action.bound toggleDevtools() {
    remote.getCurrentWebContents().toggleDevTools();
  }
  @action.bound reload() {
    remote.getCurrentWindow().reload();
  }
  @action.bound toggleFullScreen() {
    this.isFullScreen = !this.isFullScreen;
    remote.getCurrentWindow().setFullScreen(this.isFullScreen);
  }

  /////////////////// Helper methods ///////////////////
  /**
   * Deselect files that are not tagged with any tag in the current tag selection
   */
  private cleanFileSelection() {
    this.clientFileSelection.forEach((file) => {
      if (!file.tags.some((t) => this.tagSelection.includes(t))) {
        this.deselectFile(file);
      }
    });
  }
}

export default UiStore;
