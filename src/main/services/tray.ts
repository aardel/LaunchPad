import { Tray, Menu, nativeImage, app, BrowserWindow, MenuItemConstructorOptions } from 'electron';
import path from 'path';
import { AnyItem, Group } from '../../shared/types';
import { LauncherService } from './launcher';

export class TrayService {
    private tray: Tray | null = null;
    private launcher: LauncherService;
    private getMainWindow: () => BrowserWindow | null;

    constructor(launcher: LauncherService, getMainWindow: () => BrowserWindow | null) {
        this.launcher = launcher;
        this.getMainWindow = getMainWindow;
        this.initTray();
    }

    private initTray() {
        // Try to use a decent icon. On macOS, a template image is best.
        // For now, let's use a simple system-like creation or just a placeholder if valid icon not found.
        // In production, we'd bundle a specific tray icon.
        // We can try to use the app icon, resize it.
        let iconPath = '';
        if (app.isPackaged) {
            iconPath = path.join(process.resourcesPath, 'icon.png'); // Just a guess, might need adjustment
        } else {
            iconPath = path.join(__dirname, '../../resources/icon.png'); // If exists
        }

        // Fallback to empty (it shows a blank space or generic) or createFromBuffer if we really want.
        // Actually, `Tray` requires an image.
        // Let's create a simple empty nativeImage if file doesn't exist, which might look bad.
        // Better: use nativeTheme-friendly generic, or just the app icon.

        // For this environment, let's try to assume standard electron app icon behavior.
        const image = nativeImage.createFromPath(path.join(__dirname, '../../resources/trayTemplate.png'));

        // If that fails, let's try to grab the app icon.
        // If that fails, let's try to grab the app icon.
        // const appIcon = nativeImage.createFromPath(app.getPath('exe')); 
        // ^ This is tricky. 

        // Let's use a simple safe fallback: A 16x16 transparent PNG or similar if we can't find one? 

        // Let's use a simple safe fallback: A 16x16 transparent PNG or similar if we can't find one? 

        // Let's use a simple safe fallback: A 16x16 transparent PNG or similar if we can't find one?
        // Or just createEmpty() and hope we set title.
        // On macOS, we can set a Title.

        try {
            this.tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);
        } catch (e) {
            // Fallback if creating tray fails (e.g. no image)
            this.tray = new Tray(nativeImage.createEmpty());
        }

        this.tray.setTitle('🔖'); // Emoji as a fallback icon/title is actually quite effective for prototypes
        this.tray.setToolTip('LaunchIt');

        this.updateMenu([], []);
    }

    public updateMenu(groups: Group[], items: AnyItem[]) {
        if (!this.tray) return;

        const template: MenuItemConstructorOptions[] = [
            { label: 'LaunchIt', enabled: false },
            { type: 'separator' },
        ];

        if (groups.length === 0 && items.length === 0) {
            template.push({ label: 'No bookmarks', enabled: false });
        } else {
            // Group items by group
            const itemsByGroup = new Map<string, AnyItem[]>();
            items.forEach(item => {
                const groupId = item.groupId || 'ungrouped';
                if (!itemsByGroup.has(groupId)) {
                    itemsByGroup.set(groupId, []);
                }
                itemsByGroup.get(groupId)?.push(item);
            });

            // Add groups to menu
            groups.forEach(group => {
                const groupItems = itemsByGroup.get(group.id) || [];
                if (groupItems.length > 0) {
                    template.push({
                        label: group.name,
                        submenu: groupItems.map(item => ({
                            label: item.name,
                            click: () => this.launcher.launchItem(item, group.defaultProfile),
                            // We could add icons here if we fetched favicons
                        }))
                    });
                }
            });

            // Add ungrouped items
            const ungrouped = itemsByGroup.get('ungrouped') || [];
            if (ungrouped.length > 0) {
                template.push({ type: 'separator' });
                ungrouped.forEach(item => {
                    template.push({
                        label: item.name,
                        click: () => this.launcher.launchItem(item, 'local')
                    });
                });
            }
        }

        template.push(
            { type: 'separator' },
            {
                label: 'Show App',
                click: () => {
                    const win = this.getMainWindow();
                    if (win) {
                        win.show();
                        win.focus();
                    }
                }
            },
            { label: 'Quit', role: 'quit' }
        );

        const contextMenu = Menu.buildFromTemplate(template);
        this.tray.setContextMenu(contextMenu);
    }

    public destroy() {
        this.tray?.destroy();
    }
}
