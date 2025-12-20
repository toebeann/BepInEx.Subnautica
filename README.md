![BepInEx logo](assets/logo.png)

# Tobey's BepInEx Pack for Subnautica

This is a [BepInEx](https://github.com/BepInEx/BepInEx) pack for Subnautica, preconfigured and ready to use on Windows, macOS and Linux (including SteamOS)!

In particular, this pack comes with:

-   [Tobey's Unity Audio Patcher for BepInEx](https://github.com/toebeann/Tobey.UnityAudio), a configurable BepInEx patcher to automatically add Unity audio support when mods need it,
-   [Tobey's Game Info Logger for BepInEx](https://github.com/toebeann/Tobey.BepInEx.GameInfo), a simple BepInEx plugin to log information about the currently loaded Unity game,
-   [Tobey's File Tree Logger for BepInEx](https://github.com/toebeann/Tobey.FileTree), a configurable BepInEx plugin which logs the game's file tree to aid in troubleshooting issues, and
-   [Tobey's Timestamp Logger for BepInEx](https://github.com/toebeann/Tobey.BepInEx.Timestamp), a configurable BepInEx patcher which logs the current timestamp.

## Easy Automated Installation

> [!IMPORTANT]
>
> **With just this pack installed, you will not see any changes in-game!**
>
> Check the file `BepInEx` > `LogOutput.log` to determine whether BepInEx has loaded.

### Windows (Vortex)

[Vortex](https://www.nexusmods.com/about/vortex/) is a tool for installing and managing mods on Windows. It can install all kinds of mods for Subnautica and other games, including this pack.

1. Install [Vortex Mod Manager](https://www.nexusmods.com/about/vortex/) if you haven't already. Make sure it's fully up-to-date.
1. Click the Vortex button at the top of [the Nexus Mods mod page](https://www.nexusmods.com/subnautica/mods/1108) to install.
1. Check the 🔔 notifications area at the top right of Vortex:
    - If you see a notification saying "Elevation needed to deploy," click `Elevate` and authorize the elevation.
    - If you see any other notifications saying "Deployment needed" or similar, click `Deploy`.
1. Run the game.

### macOS (gib)

[gib](https://github.com/toebeann/gib) is a command-line tool which automates installation of BepInEx on macOS, as installing it manually is quite cumbersome and error-prone. gib makes it easy.

1. [Download Tobey's BepInEx Pack for Subnautica](https://github.com/toebeann/BepInEx.Subnautica/releases/latest/download/Tobey.s.BepInEx.Pack.for.Subnautica.zip). Make sure to unzip it in your Downloads folder if your browser doesn't do this automatically.
1. Open Terminal with Launchpad or Spotlight (press `⌘ Space`, type `terminal`, press `Enter`).
1. Copy the command from [the Usage section of the gib README](https://github.com/toebeann/gib#usage) and paste it into the Terminal with `⌘ V`, and press `Enter` to run it.

If you get stuck, refer to the [gib README](https://github.com/toebeann/gib#readme) for help.

## Manual Installation

> [!TIP]
>
> **Make sure to check out the [Installing mods](#installing-mods) section once you have finished installing this pack!**

> [!TIP]
>
> **The game folder is the folder containing the game's executable (e.g. `Subnautica.exe`).**
>
> Steam users can find the game folder by right-clicking the game in their Steam library and selecting `Manage` > `Browse local files`.

### Quick start

#### Windows

Extract the .zip into the game folder replacing any files if prompted, run the game once to generate all needed files and folders, then quit the game at the main menu and you're good to go. Remember to check the [Installing mods](#installing-mods) section for info on how to install mods!

If something doesn't go according to plan or you need further guidance, please refer to the [full instructions](#full-instructions-for-windows-linux-and-steam-deck-handhelds). Don't worry, it looks harder than it is. **Please don't skimread!**

#### Linux and Steam Deck handhelds

Same as for Windows but additionally follow step 4 from the [full instructions](#full-instructions-for-windows-linux-and-steam-deck-handhelds).

For Steam Deck handhelds, switch to Desktop mode to follow the instructions. Once you've got it all working, you'll be able to play with mods in either Desktop or Gaming mode as preferred.

#### macOS

It is _strongly_ recommended that macOS users [install with gib](#macos-gib), as manual installation on macOS is _extremely_ tedious and error prone!

If you are a glutton for punishment and are determined to install manually, follow [the idiot's guide to macOS installation](https://github.com/toebeann/BepInEx.Subnautica/wiki/Idiot's-guide-to-macOS-installation).

### Full instructions for Windows, Linux and Steam Deck handhelds

> [!TIP]
>
> **The game folder is the folder containing the game's executable (e.g. `Subnautica.exe`).**
>
> Steam users can find the game folder by right-clicking the game in their Steam library and selecting `Manage` > `Browse local files`.

1. [Download Tobey's BepInEx Pack for Subnautica](https://github.com/toebeann/BepInEx.Subnautica/releases/latest/download/Tobey.s.BepInEx.Pack.for.Subnautica.zip).
2. Make sure the game is not running.
3. Extract the contents of the downloaded archive into the game folder. Replace any files if prompted.

    **ℹ️** _That just means open the .zip file and drag the files and folders out into the game folder!_

    If done correctly, inside your game folder it should look something like this (the entries in bold being from the pack):

    **⚠️ _This list is used as a reference and is non-exhaustive, there will be other stuff, please don't delete anything!_**

    - _**`BepInEx`**_
    - `Subnautica_Data`
    - _**`doorstop_config.ini`**_
    - `Subnautica.exe`
    - _**`winhttp.dll`**_

        **⚠️ _If you are missing any of these files or folders, you are probably installing to the wrong place, and this pack will not work._**

4. **Skip this step if you play on Windows!**

    Linux and Steam Deck handheld users: go to your Steam library, right-click the game, select `Properties...` and set the launch options:

    ```sh
    WINEDLLOVERRIDES="winhttp=n,b" %command%
    ```

    **⚠️ _Do not set the launch options if you play the game on Windows, or the game won't run!_**

    **ℹ️** _If preferred, Linux users can instead set the Wine configuration (`winecfg`) for the game to add `winhttp` as a DLL override via the `Libraries` tab. Remove the launch options if applicable. [Full instructions here](https://docs.bepinex.dev/articles/advanced/proton_wine.html)._

5. Run the game as normal.

    Note that if you own the game on Steam, you should _always_ launch it with Steam - do not run the .exe file directly (nor via a shortcut to the .exe), as launching the .exe directly causes issues for BepInEx. You can set up a BepInEx-compatible shortcut on your desktop by right-clicking the game in Steam and selecting `Manage` > `Add desktop shortcut`.

    The same may apply to other platforms, e.g. Epic Games Launcher, Microsoft Store, etc.

    Launching the game with Vortex should be fine too.

6. Exit the game at the main menu.

Assuming you have followed these instructions correctly, inside the `BepInEx` folder there will now be a file `LogOutput.log` (or simply `LogOutput` - it's the same thing). This is your log file, and it will be egenerated every time the game runs with technical and diagnostic information about your installed mods, and any errors that might happen while playing. It's very useful for troubleshooting, and it is recommended to share it whenever asking for help with your mods. It is equivalent to the BepInEx console window you might be familiar with, containing all of the same information.

If this file is missing, it usually means that you have not installed the pack correctly and you should probably try again from scratch. Make sure to pay careful attention to the instructions and don't skimread any of the steps.

Otherwise, you can now install mods according to the [Installing mods](#installing-mods) section below.

> [!IMPORTANT]
>
> **With just this pack installed, you will not see any changes in-game!**
>
> Check the file `BepInEx` > `LogOutput.log` to determine whether BepInEx has loaded.

## Installing mods

> [!IMPORTANT]
>
> **Always make sure the game is not running when installing, removing or otherwise changing mod files!**

Installing BepInEx mods is generally as simple as opening up their .zip and dragging the contents into the right folder.

Typically, that folder is `BepInEx` > `plugins` unless the mod's instructions say otherwise. Sometimes they will want you to drag their contents directly into the game folder, or directly into the `BepInEx` folder. You should use some common sense and check the mod's instructions if you're not sure.

If you can't figure out how to install a specific mod, make sure to double check the instructions on the mod page. If there aren't any instructions on the mod page or you simply don't understand them, you'll have to get in touch with the author of the mod somehow. Your best bet is usually going to be the Nexus Mods posts tab of that mod. Make sure to check the question hasn't already been asked and answered!

## Issues, questions, etc.

First, please make sure to check that the answer you're looking for isn't already somewhere on this page. Use Ctrl+F to search for keywords.

Second, check [the FAQ](https://github.com/toebeann/BepInEx.Subnautica/wiki/FAQ) to see if there is an answer there.

If not, you can use the following channels to ask for help:

-   [Subnautica Modding Community Discord](https://discord.gg/UpWuWwq)
-   [Nexus Mods posts tab](https://www.nexusmods.com/subnautica/mods/1108/?tab=posts)
-   [GitHub issues](https://github.com/toebeann/BepInEx.Subnautica/issues)

## Useful links for mod authors

-   [Doorstop: debugging Unity Mono games](https://github.com/NeighTools/UnityDoorstop#debugging-in-unitymono)
-   [BepInEx: writing basic plugin walkthrough](https://docs.bepinex.dev/articles/dev_guide/plugin_tutorial/)
-   [BepInEx: useful plugins for modding](https://docs.bepinex.dev/articles/dev_guide/dev_tools.html)
-   [BepInEx: patching game methods at runtime](https://docs.bepinex.dev/articles/dev_guide/runtime_patching.html)
-   [Subnautica Modding Community Discord](https://discord.gg/UpWuWwq)

## Licensing

This GitHub repository contains no code or binaries from external sources, only code used to automatically put together a preconfigured .zip of the BepInEx pack.

However, the .zip created by this repository's code contains binaries from the following projects, redistributed without modification and in accordance with their licenses:

| Project                                                                        | License(s)                                                                        |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| [BepInEx](https://github.com/BepInEx/BepInEx)                                  | [MIT](https://github.com/BepInEx/BepInEx/blob/v5-lts/LICENSE)                     |
| [Tobey.BepInEx.GameInfo](https://github.com/toebeann/Tobey.BepInEx.GameInfo)   | [LGPL-3.0](https://github.com/toebeann/Tobey.BepInEx.GameInfo/blob/main/LICENSE)  |
| [Tobey.BepInEx.Timestamp](https://github.com/toebeann/Tobey.BepInEx.Timestamp) | [LGPL-3.0](https://github.com/toebeann/Tobey.BepInEx.Timestamp/blob/main/LICENSE) |
| [Tobey.FileTree](https://github.com/toebeann/Tobey.FileTree)                   | [LGPL-3.0](https://github.com/toebeann/Tobey.FileTree/blob/main/LICENSE)          |
| [Tobey.UnityAudio](https://github.com/toebeann/Tobey.UnityAudio)               | [LGPL-3.0](https://github.com/toebeann/Tobey.UnityAudio/blob/main/LICENSE)        |

The code in this repository is licensed under the [ISC license](https://github.com/toebeann/BepInEx.Subnautica/blob/main/LICENSE).
