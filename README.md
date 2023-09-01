![BepInEx logo](assets/logo.png)

# Tobey's BepInEx Pack for Subnautica

This is a [BepInEx](https://github.com/BepInEx/BepInEx) pack for Subnautica, preconfigured and ready to use on Windows, macOS and Linux (including SteamOS)!

BepInEx is a general purpose framework for Unity modding. BepInEx includes tools and libraries to

-   load custom code (hereafter _plugins_) into the game on launch;
-   patch in-game methods, classes and even entire assemblies without touching original game files;
-   configure plugins and log game to desired outputs like console or file;
-   manage plugin dependencies.

BepInEx is currently [one of the most popular modding tools for Unity on GitHub](https://github.com/topics/modding?o=desc&s=stars).

## This pack's contents

This pack is preconfigured and ready to use for Subnautica modding.
In particular, this pack comes with

- [Tobey.Subnautica.ConfigHandler](https://github.com/toebeann/Tobey.Subnautica.ConfigHandler), a configurable BepInEx patcher to automatically take care of BepInEx configuration for QModManager compatibility,
- [Tobey.UnityAudio](https://github.com/toebeann/Tobey.UnityAudio), a configurable BepInEx patcher to automatically add Unity audio support when mods need it, and
- [Tobey.FileTree](https://github.com/toebeann/Tobey.FileTree), a configurable BepInEx plugin which logs the game's file tree to aid in troubleshooting issues.

## Compatibility with QModManager

The TL;DR is that QModManager is compatibile with BepInEx, [but there are some things to bear in mind](https://github.com/toebeann/BepInEx.Subnautica/wiki/Compatibility-with-QModManager).

## General FAQ

[There is an FAQ in the wiki.](https://github.com/toebeann/BepInEx.Subnautica/wiki/FAQ)

## Installation (automatic, Windows only)

1. Install [Vortex Mod Manager](https://www.nexusmods.com/about/vortex/) if you haven't already. Make sure it's fully up-to-date.
1. Click the Vortex button at the top of [the Nexus Mods mod page](https://www.nexusmods.com/subnautica/mods/1108) to install.
    - If you have QModManager installed, Vortex might notify you to reinstall/uninstall QModManager. Just do whatever it says.
1. Check the 🔔 notifications area at the top right of Vortex:
    1. If you see a notification saying "Elevation needed to deploy," click `Elevate` and authorize the elevation.
    1. If you see any other notifications saying "Deployment needed" or similar, click `Deploy`.
1. Run the game. If everything runs correctly, you will see the BepInEx console pop up on your desktop.

## Installation on macOS for idiots

[Click here for an idiot's guide to macOS installation.](https://github.com/toebeann/BepInEx.Subnautica/wiki/Idiot's-guide-to-macOS-installation)

## Installation (manual)

**IMPORTANT NOTE**: If you later install QModManager, please make sure to choose **NOT** to overwrite any files when you do.

This is because QModManager overwrites this pack's files with an old version of BepInEx, and many BepInEx plugins require the latest version. QModManager is compatible with this pack's version of BepInEx.

If you do overwrite files when you install QModManager, you will need to reinstall this pack for some BepInEx plugins to work.

***

To install manually, follow these instructions:

1. [Download Tobey's BepInEx Pack for Subnautica](https://github.com/toebeann/BepInEx.Subnautica/releases/latest/download/BepInEx.zip)
1. Extract the contents of the downloaded archive into the game folder:
    - On Windows and Linux (SteamOS etc.), the game folder is the folder containing the game executable `Subnautica.exe`
    - On macOS, the game folder is the folder containing the game executable `Subnautica.app`
1. Depending on your operating system:
    - Windows users: Run the game. If everything runs correctly, you will see the BepInEx console pop up on your desktop.
    - Linux (SteamOS etc.) & macOS users: Follow the configuration instructions for your operating system below:

### Configuration on Linux (SteamOS etc.)

1. In Steam, go to the game's properties and set the launch arguments to:
    ```
    WINEDLLOVERRIDES="winhttp=n,b" %command%
    ```
1. Run the game via Steam

### Configuration on macOS (Steam only)

1. Make the `run_bepinex.sh` executable by running this command in Terminal:
    ```
    chmod u+x "<path to game folder>/run_bepinex.sh"
    ```
    **Note**: Make sure to replace `<path to game folder>` with the path to the folder where Subnautica is installed!
1. In Steam, go to the game's properties and set the launch arguments to:
    ```
    "<path to game folder>/run_bepinex.sh" %command%
    ```
    **Note**: Make sure to replace `<path to game folder>` with the path to the folder where Subnautica is installed!
1. Run the game via Steam
1. At this point, you may see a prompt warning you that `libdoorstop_x64.dylib` cannot be opened because the developer is unverified. In this case:
   1. Open System Preferences
   1. Go to Security & Privacy and select the General tab
   1. Towards the bottom you should see a message saying that the program was blocked from opening. Click `Open Anyway` and confirm the prompt that pops up.
   1. Run the game via Steam

At this moment you will not see any clear indication that BepInEx is working. It is suggested to test by installing a simple plugin such as [Configuration Manager](https://www.nexusmods.com/subnautica/mods/1112) and then pressing F5 to open the Configuration Manager window.

If you also wish to use QModManager, you will need to follow the [Installing QModManager on macOS](https://github.com/toebeann/BepInEx.Subnautica/wiki/Installing-QModManager-on-macOS) guide to get QModManager to work on macOS.

### Configuration on macOS (other platforms e.g. Epic Games)

The best experience for modding Subnautica on macOS is via Steam. There is however a workaround which will let you run BepInEx plugins on macOS when you own the game on a non-Steam platform, e.g. Epic Games. Mods which require BepInEx patchers are not supported via this workaround, including QModManager.

For details and instructions, see [Tobey's BepInEx 5 Hardpatcher](https://tobey.me/mods/bepinex/hardpatcher/).

## Useful links

-   [BepInEx: writing basic plugin walkthrough](https://docs.bepinex.dev/articles/dev_guide/plugin_tutorial/)
-   [BepInEx: useful plugins for modding](https://docs.bepinex.dev/articles/dev_guide/dev_tools.html)
-   [BepInEx: patching game methods at runtime](https://docs.bepinex.dev/articles/dev_guide/runtime_patching.html)

## Issues, questions, etc.

[First, check the FAQ to see if there is an answer to your question/issue.](https://github.com/toebeann/BepInEx.Subnautica/wiki/FAQ)

If not, at this moment, you can use the following channels to ask for help

-   [Subnautica Modding Community Discord](https://discord.gg/UpWuWwq)
-   [BepInEx Discord](https://discord.gg/MpFEDAg) -- **Only technical support for THIS PACKAGE. No support for plugins.**
