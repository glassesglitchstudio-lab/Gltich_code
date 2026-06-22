; Glitch Code - Setup Wizard (with AI Provider Setup)
; Inno Setup Script

#define MyAppName "Glitch Code"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "GlassesGlitchStudio"
#define MyAppURL "https://github.com/glassesglitchstudio-lab/Gltich_code"
#define MyAppExeName "mimo.exe"

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
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
DisableProgramGroupPage=yes
SetupLogging=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "turkish"; MessagesFile: "compiler:Languages\Turkish.isl"

[Tasks]
Name: "desktopicon"; Description: "Create desktop shortcut"; GroupDescription: "Shortcuts:"; Flags: checkedonce
Name: "addtopath"; Description: "Add to PATH (type 'mimo' from any CMD)"; GroupDescription: "Installation Options:"; Flags: checkedonce

[Files]
Source: "..\packages\opencode\dist\mimocode-windows-x64\bin\mimo.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{%USERPROFILE}\GlitchCodeProjects"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{%USERPROFILE}\GlitchCodeProjects"; Tasks: desktopicon

[Run]
Filename: "{cmd}"; Parameters: "/C cd /d ""{%USERPROFILE}\GlitchCodeProjects"" && ""{app}\{#MyAppExeName}"""; Description: "{cm:LaunchProgram,{#MyAppName}}"; Flags: nowait postinstall skipifsilent

[Registry]
Root: HKLM; Subkey: "SYSTEM\CurrentControlSet\Control\Session Manager\Environment"; \
    ValueType: expandsz; ValueName: "Path"; ValueData: "{olddata};{app}"; \
    Tasks: addtopath; Check: NeedsAddPath(ExpandConstant('{app}'))

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

const
  PROVIDER_OPENAI = 0;
  PROVIDER_ANTHROPIC = 1;
  PROVIDER_GOOGLE = 2;
  PROVIDER_OLLAMA = 3;
  PROVIDER_GROQ = 4;
  PROVIDER_OPENROUTER = 5;
  PROVIDER_DEEPSEEK = 6;
  PROVIDER_XIAOMI = 7;

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

procedure CreateProviderPage;
var
  DescLabel: TLabel;
begin
  ProviderPage := CreateCustomPage(wpSelectTasks,
    'AI Provider Secimi',
    'Hangi AI saglayicisini kullanmak istiyorsun?');

  DescLabel := TLabel.Create(ProviderPage);
  DescLabel.Parent := ProviderPage.Surface;
  DescLabel.Caption := 'AI model saglayicini sec. Dilersen kurulumdan sonra da degistirebilirsin.';
  DescLabel.AutoSize := False;
  DescLabel.WordWrap := True;
  DescLabel.Width := 400;

  ProviderCombo := TComboBox.Create(ProviderPage);
  ProviderCombo.Parent := ProviderPage.Surface;
  ProviderCombo.Top := 40;
  ProviderCombo.Width := 400;
  ProviderCombo.Height := 24;
  ProviderCombo.Style := csDropDownList;
  ProviderCombo.Items.Add('OpenAI - gpt-4o, gpt-4o-mini');
  ProviderCombo.Items.Add('Anthropic - claude-sonnet-4, claude-haiku-3.5');
  ProviderCombo.Items.Add('Google - gemini-2.5-pro');
  ProviderCombo.Items.Add('Ollama (yerel) - hic kurulum gerekmez');
  ProviderCombo.Items.Add('Groq - hizli, ucretsiz');
  ProviderCombo.Items.Add('OpenRouter - her modele tek API');
  ProviderCombo.Items.Add('DeepSeek - ucuz, guclu');
  ProviderCombo.Items.Add('Xiaomi - UYARI: Browser acar (OAuth)');
  ProviderCombo.ItemIndex := PROVIDER_OPENAI;
  ProviderCombo.OnChange := @ProviderComboChange;
end;

procedure CreateApiKeyPage;
var
  DescLabel: TLabel;
  SkipLabel: TLabel;
begin
  ApiKeyPage := CreateCustomPage(ProviderPage.ID,
    'API Anahtari',
    'AI saglayicinin API anahtarini gir (opsiyonel).');

  DescLabel := TLabel.Create(ApiKeyPage);
  DescLabel.Parent := ApiKeyPage.Surface;
  DescLabel.Caption := 'API anahtarin ne? (bos birakirsan sonra .env dosyasindan okur)';
  DescLabel.AutoSize := False;
  DescLabel.WordWrap := True;
  DescLabel.Width := 400;

  ApiKeyEdit := TEdit.Create(ApiKeyPage);
  ApiKeyEdit.Parent := ApiKeyPage.Surface;
  ApiKeyEdit.Top := 40;
  ApiKeyEdit.Width := 400;
  ApiKeyEdit.Height := 24;
  ApiKeyEdit.PasswordChar := '*';

  SkipLabel := TLabel.Create(ApiKeyPage);
  SkipLabel.Parent := ApiKeyPage.Surface;
  SkipLabel.Top := 70;
  SkipLabel.Caption := 'Bos birakabilirsin, sonra mimo icinde ayarlarsin.';
  SkipLabel.AutoSize := False;
  SkipLabel.WordWrap := True;
  SkipLabel.Width := 400;
end;

procedure CreateModelPage;
var
  DescLabel: TLabel;
begin
  ModelPage := CreateCustomPage(ApiKeyPage.ID,
    'Varsayilan Model',
    'Hangi model varsayilan olsun?');

  DescLabel := TLabel.Create(ModelPage);
  DescLabel.Parent := ModelPage.Surface;
  DescLabel.Caption := 'Varsayilan model adi:';
  DescLabel.AutoSize := False;
  DescLabel.WordWrap := True;
  DescLabel.Width := 400;

  ModelEdit := TEdit.Create(ModelPage);
  ModelEdit.Parent := ModelPage.Surface;
  ModelEdit.Top := 40;
  ModelEdit.Width := 400;
  ModelEdit.Height := 24;

  DescLabel := TLabel.Create(ModelPage);
  DescLabel.Parent := ModelPage.Surface;
  DescLabel.Top := 70;
  DescLabel.Caption := 'Provider''a gore otomatik dolduruldu. Istersen degistirebilirsin.';
  DescLabel.AutoSize := False;
  DescLabel.WordWrap := True;
  DescLabel.Width := 400;
end;

procedure CreateInstructionsPage;
var
  DescLabel: TLabel;
begin
  InstructionsPage := CreateCustomPage(ModelPage.ID,
    'Proje Talimatlari',
    'Varsayilan proje talimatlarin var mi? (opsiyonel)');

  DescLabel := TLabel.Create(InstructionsPage);
  DescLabel.Parent := InstructionsPage.Surface;
  DescLabel.Caption := 'Ornek: "React + TypeScript kullan, Tailwind CSS ile stil ver"';
  DescLabel.AutoSize := False;
  DescLabel.WordWrap := True;
  DescLabel.Width := 400;

  InstructionsMemo := TMemo.Create(InstructionsPage);
  InstructionsMemo.Parent := InstructionsPage.Surface;
  InstructionsMemo.Top := 40;
  InstructionsMemo.Width := 400;
  InstructionsMemo.Height := 120;
  InstructionsMemo.ScrollBars := ssVertical;
end;

procedure InitializeWizard;
begin
  CreateProviderPage;
  CreateApiKeyPage;
  CreateModelPage;
  CreateInstructionsPage;
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := False;
  // Skip API key page for Ollama (local, no key needed)
  if (PageID = ApiKeyPage.ID) and (ProviderCombo.ItemIndex = PROVIDER_OLLAMA) then
    Result := True;
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
  ConfigJson: string;
begin
  if CurStep = ssPostInstall then
  begin
    ProviderID := GetProviderID;
    ApiKeyValue := Trim(ApiKeyEdit.Text);
    ModelValue := Trim(ModelEdit.Text);
    InstructionsValue := Trim(InstructionsMemo.Text);

    if ModelValue = '' then
      ModelValue := GetDefaultModel(ProviderCombo.ItemIndex);

    // Write auth.json to user's AppData
    AuthDir := ExpandConstant('{localappdata}') + '\mimocode';
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

    // Write .glitch/config.json to user profile
    GlitchDir := ExpandConstant('{%USERPROFILE}') + '\GlitchCodeProjects';
    if not DirExists(GlitchDir) then
      CreateDir(GlitchDir);
    GlitchDir := GlitchDir + '\.glitch';
    if not DirExists(GlitchDir) then
      CreateDir(GlitchDir);

    ConfigFile := ExpandConstant('{%USERPROFILE}') + '\GlitchCodeProjects\.glitch\config.json';
    ConfigJson := '{'#13#10 +
      '  "version": "1.0",'#13#10 +
      '  "project": "GlitchCodeProjects",'#13#10 +
      '  "type": "auto",'#13#10 +
      '  "provider": "' + EscapeJson(ProviderID) + '",'#13#10 +
      '  "model": "' + EscapeJson(ModelValue) + '",'#13#10 +
      '  "instructions": "' + EscapeJson(InstructionsValue) + '",'#13#10 +
      '  "created": "' + GetDateTimeString('yyyy-mm-dd hh:nn:ss', '-', ':') + '"'#13#10 +
      '}';
    SaveStringToFile(ConfigFile, ConfigJson, False);
  end;
end;
