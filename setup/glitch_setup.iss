; Glitch Code - Setup Wizard v2.0 (GlassesCat Edition)
; Inno Setup Script - Modern + Animated

#define MyAppName "Glitch Code"
#define MyAppVersion "2.0.0"
#define MyAppPublisher "GlassesGlitchStudio"
#define MyAppURL "https://github.com/glassesglitchstudio-lab/Gltich_code"
#define MyAppExeName "glitch.exe"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\GlitchCode
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=..\dist
OutputBaseFilename=GlitchCode_Setup_v{#MyAppVersion}
Compression=lzma2/ultra
SolidCompression=yes
WizardStyle=modern
WizardResizable=yes
DisableWelcomePage=no
DisableFinishedPage=no
PrivilegesRequired=admin
DisableProgramGroupPage=yes
SetupLogging=yes
SetupIconFile=glitch.ico
AppCopyright=GlassesGlitchStudio 2026
VersionInfoDescription=Glitch Code AI Platform
VersionInfoProductName=Glitch Code
VersionInfoProductVersion={#MyAppVersion}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "turkish"; MessagesFile: "compiler:Languages\Turkish.isl"

[Tasks]
Name: "desktopicon"; Description: "Create desktop shortcut"; GroupDescription: "Shortcuts:"; Flags: checkedonce
Name: "addtopath"; Description: "Add to PATH (type 'glitch' from any CMD)"; GroupDescription: "Installation Options:"; Flags: checkedonce
Name: "autostart"; Description: "Auto-start Glitch Code on Windows login"; GroupDescription: "Startup Options:"; Flags: checkedonce

[Files]
; Tum dosyalar git clone ile gelecek

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\packages\opencode\dist\mimocode-windows-x64\bin\glitch.exe"; WorkingDir: "{app}"; IconFilename: "{app}\setup\glitch.ico"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\packages\opencode\dist\mimocode-windows-x64\bin\glitch.exe"; WorkingDir: "{app}"; IconFilename: "{app}\setup\glitch.ico"; Tasks: desktopicon

[Run]
Filename: "{cmd}"; Parameters: "/C cd /d ""{app}"" && ""{app}\packages\opencode\dist\mimocode-windows-x64\bin\glitch.exe"""; Description: "{cm:LaunchProgram,{#MyAppName}}"; Flags: nowait postinstall skipifsilent

[Registry]
Root: HKLM; Subkey: "SYSTEM\CurrentControlSet\Control\Session Manager\Environment"; \
    ValueType: expandsz; ValueName: "Path"; ValueData: "{olddata};{app}\packages\opencode\dist\mimocode-windows-x64\bin"; \
    Tasks: addtopath; Check: NeedsAddPath(ExpandConstant('{app}\packages\opencode\dist\mimocode-windows-x64\bin'))

; Auto-start with Windows
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentControlSet\Run"; \
    ValueType: string; ValueName: "GlitchCode"; ValueData: "{app}\packages\opencode\dist\mimocode-windows-x64\bin\glitch.exe --daemon"; \
    Tasks: autostart

[Code]
var
  ProviderPage: TWizardPage;
  ApiKeyPage: TWizardPage;
  ModelPage: TWizardPage;
  InstructionsPage: TWizardPage;

  ProviderCombo: TComboBox;
  ApiKeyEdit: TEdit;
  ModelEdit: TEdit;
  InstructionsMemo: TMemo;

  // Animation
  AnimLabel: TLabel;
  SplashPage: TWizardPage;
  InstallAnimLabel: TLabel;

const
  PROVIDER_OPENAI = 0;
  PROVIDER_ANTHROPIC = 1;
  PROVIDER_GOOGLE = 2;
  PROVIDER_OLLAMA = 3;
  PROVIDER_GROQ = 4;
  PROVIDER_OPENROUTER = 5;
  PROVIDER_DEEPSEEK = 6;
  PROVIDER_XIAOMI = 7;

  // GlassesCat ASCII Logo
  LOGO_LINE1 = '   _____ _ _       _     _____          _        ';
  LOGO_LINE2 = '  / ____| (_)     | |   / ____|        | |       ';
  LOGO_LINE3 = ' | |  __| |_  ___| |_ | |     ___   ___| | _____ ';
  LOGO_LINE4 = ' | | |_ | | |/ _ \ __|| |    / _ \ / __| |/ / __|';
  LOGO_LINE5 = ' | |__| | | |  __/ |_ | |___| (_) | (__|   <\__ \';
  LOGO_LINE6 = '  \_____|_|_|\___|\__| \_____\___/ \___|_|\_\___/';
  LOGO_LINE7 = '                                                  ';
  LOGO_LINE8 = '  🚀 GlassesCat AI - Otonom Kod Asistani         ';

function NeedsAddPath(Param: string): boolean;
var
  OrigPath: string;
begin
  if not RegQueryStringValue(HKEY_LOCAL_MACHINE,
    'SYSTEM\CurrentControlSet\Control\Session Manager\Environment',
    'Path', OrigPath)
  then begin
    Result := True;
    exit;
  end;
  Result := Pos(';' + Param + ';', ';' + OrigPath + ';') = 0;
end;

function GetProviderID: string;
begin
  case ProviderCombo.ItemIndex of
    PROVIDER_OPENAI: Result := 'openai';
    PROVIDER_ANTHROPIC: Result := 'anthropic';
    PROVIDER_GOOGLE: Result := 'google';
    PROVIDER_OLLAMA: Result := 'ollama';
    PROVIDER_GROQ: Result := 'groq';
    PROVIDER_OPENROUTER: Result := 'openrouter';
    PROVIDER_DEEPSEEK: Result := 'deepseek';
    PROVIDER_XIAOMI: Result := 'xiaomi';
    else Result := 'auto';
  end;
end;

function GetDefaultModel(ProviderIndex: Integer): string;
begin
  case ProviderIndex of
    PROVIDER_OPENAI: Result := 'gpt-4o';
    PROVIDER_ANTHROPIC: Result := 'claude-sonnet-4-20250514';
    PROVIDER_GOOGLE: Result := 'gemini-2.5-pro';
    PROVIDER_OLLAMA: Result := 'llama3';
    PROVIDER_GROQ: Result := 'llama-3.3-70b-versatile';
    PROVIDER_OPENROUTER: Result := 'auto';
    PROVIDER_DEEPSEEK: Result := 'deepseek-chat';
    PROVIDER_XIAOMI: Result := 'auto';
    else Result := 'auto';
  end;
end;

procedure ProviderComboChange(Sender: TObject);
begin
  ModelEdit.Text := GetDefaultModel(ProviderCombo.ItemIndex);
end;

// ─── SPLASH PAGE ─────────────────────────────────────────

procedure CreateSplashPage(AfterID: Integer);
var
  LogoLabel: TLabel;
  SubLabel: TLabel;
begin
  SplashPage := CreateCustomPage(AfterID, '', '');

  LogoLabel := TLabel.Create(SplashPage);
  LogoLabel.Parent := SplashPage.Surface;
  LogoLabel.Top := 20;
  LogoLabel.Left := 0;
  LogoLabel.Width := SplashPage.SurfaceWidth;
  LogoLabel.Alignment := taCenter;
  LogoLabel.Font.Name := 'Consolas';
  LogoLabel.Font.Size := 9;
  LogoLabel.Font.Style := [fsBold];
  LogoLabel.Caption := LOGO_LINE1 + #13#10 +
    LOGO_LINE2 + #13#10 +
    LOGO_LINE3 + #13#10 +
    LOGO_LINE4 + #13#10 +
    LOGO_LINE5 + #13#10 +
    LOGO_LINE6;

  SubLabel := TLabel.Create(SplashPage);
  SubLabel.Parent := SplashPage.Surface;
  SubLabel.Top := 180;
  SubLabel.Left := 0;
  SubLabel.Width := SplashPage.SurfaceWidth;
  SubLabel.Alignment := taCenter;
  SubLabel.Font.Size := 12;
  SubLabel.Font.Style := [fsBold];
  SubLabel.Caption := 'Glitch Code v2.0';
  SubLabel.Font.Color := clHighlight;

  AnimLabel := TLabel.Create(SplashPage);
  AnimLabel.Parent := SplashPage.Surface;
  AnimLabel.Top := 210;
  AnimLabel.Left := 0;
  AnimLabel.Width := SplashPage.SurfaceWidth;
  AnimLabel.Alignment := taCenter;
  AnimLabel.Font.Size := 10;
  AnimLabel.Caption := 'GlassesCat AI — Kurulum basliyor...';
end;

// ─── PROVIDER SELECTION PAGE ──────────────────────────────

procedure CreateProviderPage;
var
  DescLabel: TLabel;
  LogoLabel: TLabel;
begin
  ProviderPage := CreateCustomPage(wpSelectTasks,
    'AI Provider Secimi',
    'Hangi AI saglayicisini kullanmak istiyorsun?');

  LogoLabel := TLabel.Create(ProviderPage);
  LogoLabel.Parent := ProviderPage.Surface;
  LogoLabel.Caption := '⚡';
  LogoLabel.Font.Size := 32;
  LogoLabel.Top := 0;
  LogoLabel.Left := 180;
  LogoLabel.AutoSize := True;

  DescLabel := TLabel.Create(ProviderPage);
  DescLabel.Parent := ProviderPage.Surface;
  DescLabel.Caption := 'AI model saglayicini sec. GlassesCat modelleri otomatik taninir.' + #13#10 +
    'Dilersen kurulumdan sonra da degistirebilirsin.';
  DescLabel.AutoSize := False;
  DescLabel.WordWrap := True;
  DescLabel.Width := 400;
  DescLabel.Top := 60;

  ProviderCombo := TComboBox.Create(ProviderPage);
  ProviderCombo.Parent := ProviderPage.Surface;
  ProviderCombo.Top := 100;
  ProviderCombo.Width := 400;
  ProviderCombo.Height := 28;
  ProviderCombo.Style := csDropDownList;
  ProviderCombo.Font.Size := 10;
  ProviderCombo.Items.Add('OpenAI - gpt-4o, gpt-4o-mini');
  ProviderCombo.Items.Add('Anthropic - claude-sonnet-4, claude-haiku-3.5');
  ProviderCombo.Items.Add('Google - gemini-2.5-pro');
  ProviderCombo.Items.Add('🌟 Ollama (yerel) - GlassesCat modelleri icin tavsiye edilir');
  ProviderCombo.Items.Add('Groq - hizli, ucretsiz');
  ProviderCombo.Items.Add('OpenRouter - her modele tek API');
  ProviderCombo.Items.Add('DeepSeek - ucuz, guclu');
  ProviderCombo.Items.Add('Xiaomi - UYARI: Browser acar (OAuth)');
  ProviderCombo.ItemIndex := PROVIDER_OLLAMA;
  ProviderCombo.OnChange := @ProviderComboChange;
end;

// ─── API KEY PAGE ────────────────────────────────────────

procedure CreateApiKeyPage;
var
  DescLabel: TLabel;
  SkipLabel: TLabel;
  KeyLabel: TLabel;
begin
  ApiKeyPage := CreateCustomPage(ProviderPage.ID,
    'API Anahtari',
    'AI saglayicinin API anahtarini gir.');

  KeyLabel := TLabel.Create(ApiKeyPage);
  KeyLabel.Parent := ApiKeyPage.Surface;
  KeyLabel.Caption := '🔑';
  KeyLabel.Font.Size := 28;
  KeyLabel.Top := 0;
  KeyLabel.Left := 180;

  DescLabel := TLabel.Create(ApiKeyPage);
  DescLabel.Parent := ApiKeyPage.Surface;
  DescLabel.Caption := 'API anahtarin ne?' + #13#10 +
    'Ollama sectiysen bos birakabilirsin (yerel calisir).';
  DescLabel.AutoSize := False;
  DescLabel.WordWrap := True;
  DescLabel.Width := 400;
  DescLabel.Top := 50;

  ApiKeyEdit := TEdit.Create(ApiKeyPage);
  ApiKeyEdit.Parent := ApiKeyPage.Surface;
  ApiKeyEdit.Top := 90;
  ApiKeyEdit.Width := 400;
  ApiKeyEdit.Height := 26;
  ApiKeyEdit.Font.Size := 11;
  ApiKeyEdit.PasswordChar := '*';

  SkipLabel := TLabel.Create(ApiKeyPage);
  SkipLabel.Parent := ApiKeyPage.Surface;
  SkipLabel.Top := 125;
  SkipLabel.Caption := 'Bos birakabilirsin, sonra glitch icinde ayarlarsin.';
  SkipLabel.AutoSize := False;
  SkipLabel.WordWrap := True;
  SkipLabel.Width := 400;
  SkipLabel.Font.Color := clGray;
end;

// ─── MODEL PAGE ──────────────────────────────────────────

procedure CreateModelPage;
var
  DescLabel: TLabel;
  ModelLabel: TLabel;
begin
  ModelPage := CreateCustomPage(ApiKeyPage.ID,
    'Varsayilan Model',
    'Hangi model varsayilan olsun?');

  ModelLabel := TLabel.Create(ModelPage);
  ModelLabel.Parent := ModelPage.Surface;
  ModelLabel.Caption := '🤖';
  ModelLabel.Font.Size := 28;
  ModelLabel.Top := 0;
  ModelLabel.Left := 180;

  DescLabel := TLabel.Create(ModelPage);
  DescLabel.Parent := ModelPage.Surface;
  DescLabel.Caption := 'Varsayilan model adi (provider a gore otomatik dolduruldu):';
  DescLabel.AutoSize := False;
  DescLabel.WordWrap := True;
  DescLabel.Width := 400;
  DescLabel.Top := 50;

  ModelEdit := TEdit.Create(ModelPage);
  ModelEdit.Parent := ModelPage.Surface;
  ModelEdit.Top := 80;
  ModelEdit.Width := 400;
  ModelEdit.Height := 26;
  ModelEdit.Font.Size := 11;

  DescLabel := TLabel.Create(ModelPage);
  DescLabel.Parent := ModelPage.Surface;
  DescLabel.Top := 115;
  DescLabel.Caption := 'Provider a gore otomatik dolduruldu. Istersen degistirebilirsin.' + #13#10 +
    'GlassesCat kullanicilari: gulmzcetiner:V5_NEXUS_CORE tavsiye edilir.';
  DescLabel.AutoSize := False;
  DescLabel.WordWrap := True;
  DescLabel.Width := 400;
  DescLabel.Font.Color := clGray;
end;

// ─── INSTRUCTIONS PAGE ───────────────────────────────────

procedure CreateInstructionsPage;
var
  DescLabel: TLabel;
  InstLabel: TLabel;
begin
  InstructionsPage := CreateCustomPage(ModelPage.ID,
    'Proje Talimatlari',
    'Varsayilan proje talimatlarin var mi? (opsiyonel)');

  InstLabel := TLabel.Create(InstructionsPage);
  InstLabel.Parent := InstructionsPage.Surface;
  InstLabel.Caption := '📝';
  InstLabel.Font.Size := 28;
  InstLabel.Top := 0;
  InstLabel.Left := 180;

  DescLabel := TLabel.Create(InstructionsPage);
  DescLabel.Parent := InstructionsPage.Surface;
  DescLabel.Caption := 'Ornek: "React + TypeScript kullan, Tailwind CSS ile stil ver, ' + #13#10 +
    'GlassesCat AI ozelliklerini aktif et"';
  DescLabel.AutoSize := False;
  DescLabel.WordWrap := True;
  DescLabel.Width := 400;
  DescLabel.Top := 50;

  InstructionsMemo := TMemo.Create(InstructionsPage);
  InstructionsMemo.Parent := InstructionsPage.Surface;
  InstructionsMemo.Top := 80;
  InstructionsMemo.Width := 400;
  InstructionsMemo.Height := 140;
  InstructionsMemo.Font.Size := 10;
  InstructionsMemo.ScrollBars := ssVertical;
end;

// ─── WIZARD INIT ─────────────────────────────────────────

procedure InitializeWizard;
begin
  CreateSplashPage(wpWelcome);
  CreateProviderPage;
  CreateApiKeyPage;
  CreateModelPage;
  CreateInstructionsPage;

  // Set wizard colours
  WizardForm.Color := clWindow;
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := False;
  if (PageID = ApiKeyPage.ID) and (ProviderCombo.ItemIndex = PROVIDER_OLLAMA) then
    Result := True;
end;

// ─── INSTALL PROGRESS ANIMATION ─────────────────────────

var
  InstallProgressMsg: string;
  InstallDotsCount: Integer;

procedure CurPageChanged(CurPageID: Integer);
begin
  if CurPageID = wpInstalling then
  begin
    InstallDotsCount := 0;
    InstallAnimLabel := TLabel.Create(WizardForm);
    InstallAnimLabel.Parent := WizardForm.InstallingPage;
    InstallAnimLabel.Top := 180;
    InstallAnimLabel.Left := 120;
    InstallAnimLabel.Font.Size := 11;
    InstallAnimLabel.Font.Style := [fsBold];
    InstallAnimLabel.Caption := 'GlassesCat AI kuruluyor...';
  end;
end;

procedure CurInstallProgressChanged(CurProgress, MaxProgress: Integer);
begin
  if Assigned(InstallAnimLabel) then
  begin
    InstallDotsCount := InstallDotsCount + 1;
    if InstallDotsCount mod 10 = 0 then
      InstallAnimLabel.Caption := 'GlassesCat AI kuruluyor' + StringOfChar('.', (InstallDotsCount div 10) mod 4 + 1);
  end;
end;

function GitExists: Boolean;
var
  ResultCode: Integer;
begin
  Result := Exec('git', '--version', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0);
end;

function EscapeJson(S: string): string;
var
  i: Integer;
  C: Char;
begin
  Result := '';
  for i := 1 to Length(S) do
  begin
    C := S[i];
    if C = '"' then Result := Result + '\"'
    else if C = '\' then Result := Result + '\\'
    else if C = '/' then Result := Result + '\/'
    else if (C = #8) then Result := Result + '\b'
    else if (C = #9) then Result := Result + '\t'
    else if (C = #10) then Result := Result + '\n'
    else if (C = #13) then Result := Result + '\r'
    else if (C = #12) then Result := Result + '\f'
    else Result := Result + C;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  AuthDir: string;
  AuthFile: string;
  GlitchDir: string;
  ConfigFile: string;
  ProviderID: string;
  ApiKeyValue: string;
  ModelValue: string;
  InstructionsValue: string;
  AuthJson: string;
  ResultCode: Integer;
  ConfigJson: string;
begin
  if CurStep = ssPostInstall then
  begin
    // 1) Git clone — repo'yu dogrudan {app}'e cek
    if GitExists and not DirExists(ExpandConstant('{app}') + '\.git') then
      Exec('git', 'clone --depth 1 https://github.com/glassesglitchstudio-lab/Gltich_code.git "' + ExpandConstant('{app}') + '"', '', SW_SHOW, ewWaitUntilTerminated, ResultCode);

    ProviderID := GetProviderID;
    ApiKeyValue := Trim(ApiKeyEdit.Text);
    ModelValue := Trim(ModelEdit.Text);
    InstructionsValue := Trim(InstructionsMemo.Text);

    if ModelValue = '' then
      ModelValue := GetDefaultModel(ProviderCombo.ItemIndex);

    // Write auth.json to user's AppData (glitchcode klasoru)
    AuthDir := ExpandConstant('{localappdata}') + '\glitchcode';
    if not DirExists(AuthDir) then
      CreateDir(AuthDir);

    if ApiKeyValue <> '' then
    begin
      AuthFile := AuthDir + '\auth.json';
      AuthJson := '{'#13#10 +
        '  "' + EscapeJson(ProviderID) + '": {'#13#10 +
        '    "type": "api",'#13#10 +
        '    "key": "' + EscapeJson(ApiKeyValue) + '"'#13#10 +
        '  }'#13#10 +
        '}';
      SaveStringToFile(AuthFile, AuthJson, False);
    end;

    // Write .glitch/config.json to kurulum klasoru (kullanici nereye kurduysa oraya)
    GlitchDir := ExpandConstant('{app}');
    GlitchDir := GlitchDir + '\.glitch';
    if not DirExists(GlitchDir) then
      CreateDir(GlitchDir);

    ConfigFile := ExpandConstant('{app}') + '\.glitch\config.json';
    ConfigJson := '{'#13#10 +
      '  "version": "2.0",'#13#10 +
      '  "project": "GlitchCodeProjects",'#13#10 +
      '  "type": "auto",'#13#10 +
      '  "provider": "' + EscapeJson(ProviderID) + '",'#13#10 +
      '  "model": "' + EscapeJson(ModelValue) + '",'#13#10 +
      '  "instructions": "' + EscapeJson(InstructionsValue) + '",'#13#10 +
      '  "edition": "GlassesCat",'#13#10 +
      '  "created": "' + GetDateTimeString('yyyy-mm-dd hh:nn:ss', '-', ':') + '"'#13#10 +
      '}';
    SaveStringToFile(ConfigFile, ConfigJson, False);
  end;
end;
