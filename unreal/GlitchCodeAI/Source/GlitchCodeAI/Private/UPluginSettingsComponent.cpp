#include "UPluginSettingsComponent.h"
#include "Misc/ConfigCacheIni.h"
#include "Misc/Paths.h"
#include "Misc/FileHelper.h"
#include "HAL/PlatformFileManager.h"
#include "Dom/JsonObject.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonWriter.h"
#include "Serialization/JsonSerializer.h"

DEFINE_LOG_CATEGORY_STATIC(LogPluginSettings, Log, All);

UPluginSettingsComponent::UPluginSettingsComponent()
{
    PrimaryComponentTick.bCanEverTick = false;
}

void UPluginSettingsComponent::BeginPlay()
{
    Super::BeginPlay();

    // Try to load existing settings
    if (!LoadSettings())
    {
        ApplyDefaults();
    }
}

FString UPluginSettingsComponent::GetString(const FString& Key, const FString& Section) const
{
    FString FullKey = Section + TEXT(".") + Key;
    const FString* Value = SettingsMap.Find(FullKey);
    return Value ? *Value : FString();
}

void UPluginSettingsComponent::SetString(const FString& Key, const FString& Value, const FString& Section)
{
    FString FullKey = Section + TEXT(".") + Key;
    SettingsMap.Add(FullKey, Value);

    // Also update GConfig for ini-based access
    GConfig->SetString(*Section, *Key, *Value, GGameIni);

    OnSettingChanged.Broadcast(Key, Value);

    if (bAutoSave)
    {
        SaveSettings();
    }
}

int32 UPluginSettingsComponent::GetInt(const FString& Key, int32 Default, const FString& Section) const
{
    FString Value = GetString(Key, Section);
    if (Value.IsEmpty()) return Default;
    return FCString::Atoi(*Value);
}

void UPluginSettingsComponent::SetInt(const FString& Key, int32 Value, const FString& Section)
{
    SetString(Key, FString::FromInt(Value), Section);
}

float UPluginSettingsComponent::GetFloat(const FString& Key, float Default, const FString& Section) const
{
    FString Value = GetString(Key, Section);
    if (Value.IsEmpty()) return Default;
    return FCString::Atof(*Value);
}

void UPluginSettingsComponent::SetFloat(const FString& Key, float Value, const FString& Section)
{
    SetString(Key, FString::SanitizeFloat(Value), Section);
}

bool UPluginSettingsComponent::GetBool(const FString& Key, bool bDefault, const FString& Section) const
{
    FString Value = GetString(Key, Section);
    if (Value.IsEmpty()) return bDefault;
    return Value.ToBool();
}

void UPluginSettingsComponent::SetBool(const FString& Key, bool bValue, const FString& Section)
{
    SetString(Key, bValue ? TEXT("true") : TEXT("false"), Section);
}

bool UPluginSettingsComponent::SaveSettings()
{
    FString FullPath = GetFullConfigPath();
    FString Dir = FPaths::GetPath(FullPath);

    // Ensure directory exists
    IFileManager& FileManager = IFileManager::Get();
    if (!FileManager.DirectoryExists(*Dir))
    {
        FileManager.MakeDirectory(*Dir, true);
    }

    // Write settings as simple key=value pairs
    FString Content;
    for (const auto& Pair : SettingsMap)
    {
        Content += FString::Printf(TEXT("%s=%s\n"), *Pair.Key, *Pair.Value);
    }

    bool bSuccess = FFileHelper::SaveStringToFile(Content, *FullPath);

    if (bSuccess)
    {
        UE_LOG(LogPluginSettings, Log, TEXT("PluginSettings: Saved %d settings to '%s'"), 
            SettingsMap.Num(), *FullPath);
    }
    else
    {
        UE_LOG(LogPluginSettings, Error, TEXT("PluginSettings: Failed to save to '%s'"), *FullPath);
    }

    return bSuccess;
}

bool UPluginSettingsComponent::LoadSettings()
{
    FString FullPath = GetFullConfigPath();

    if (!FPaths::FileExists(FullPath))
    {
        UE_LOG(LogPluginSettings, Log, TEXT("PluginSettings: No config file at '%s'"), *FullPath);
        return false;
    }

    FString Content;
    if (!FFileHelper::LoadFileToString(Content, *FullPath))
    {
        UE_LOG(LogPluginSettings, Error, TEXT("PluginSettings: Failed to load '%s'"), *FullPath);
        return false;
    }

    SettingsMap.Empty();

    TArray<FString> Lines;
    Content.ParseIntoArrayLines(Lines, false);

    for (const FString& Line : Lines)
    {
        FString Trimmed = Line.TrimStartAndEnd();
        if (Trimmed.IsEmpty() || Trimmed.StartsWith(TEXT(";")) || Trimmed.StartsWith(TEXT("#")))
        {
            continue; // Skip comments and empty lines
        }

        FString Key, Value;
        if (SplitLine(Trimmed, Key, Value))
        {
            SettingsMap.Add(Key, Value);
        }
    }

    UE_LOG(LogPluginSettings, Log, TEXT("PluginSettings: Loaded %d settings from '%s'"), 
        SettingsMap.Num(), *FullPath);

    OnSettingsLoaded.Broadcast(true);
    return true;
}

bool UPluginSettingsComponent::ExportToJson(const FString& FilePath) const
{
    TSharedPtr<FJsonObject> JsonObject = MakeShareable(new FJsonObject());

    for (const auto& Pair : SettingsMap)
    {
        JsonObject->SetStringField(Pair.Key, Pair.Value);
    }

    FString OutputString;
    TSharedRef<TJsonWriter<>> JsonWriter = TJsonWriterFactory<>::Create(&OutputString);
    bool bSuccess = FJsonSerializer::Serialize(JsonObject.ToSharedRef(), JsonWriter);

    if (bSuccess)
    {
        bSuccess = FFileHelper::SaveStringToFile(OutputString, *FilePath);
    }

    if (bSuccess)
    {
        UE_LOG(LogPluginSettings, Log, TEXT("PluginSettings: Exported to '%s'"), *FilePath);
    }

    return bSuccess;
}

bool UPluginSettingsComponent::ImportFromJson(const FString& FilePath)
{
    if (!FPaths::FileExists(FilePath))
    {
        UE_LOG(LogPluginSettings, Warning, TEXT("PluginSettings: JSON file not found '%s'"), *FilePath);
        return false;
    }

    FString JsonString;
    if (!FFileHelper::LoadFileToString(JsonString, *FilePath))
    {
        return false;
    }

    TSharedPtr<FJsonObject> JsonObject;
    TSharedRef<TJsonReader<>> JsonReader = TJsonReaderFactory<>::Create(JsonString);

    if (!FJsonSerializer::Deserialize(JsonReader, JsonObject) || !JsonObject.IsValid())
    {
        UE_LOG(LogPluginSettings, Error, TEXT("PluginSettings: Failed to parse JSON from '%s'"), *FilePath);
        return false;
    }

    SettingsMap.Empty();

    for (const auto& Pair : JsonObject->Values)
    {
        if (Pair.Value.IsValid() && Pair.Value->Type == EJson::String)
        {
            SettingsMap.Add(Pair.Key, Pair.Value->AsString());
        }
    }

    UE_LOG(LogPluginSettings, Log, TEXT("PluginSettings: Imported %d settings from '%s'"), 
        SettingsMap.Num(), *FilePath);

    if (bAutoSave)
    {
        SaveSettings();
    }

    return true;
}

void UPluginSettingsComponent::ResetToDefaults()
{
    SettingsMap.Empty();
    ApplyDefaults();
    SaveSettings();
    UE_LOG(LogPluginSettings, Log, TEXT("PluginSettings: Reset to defaults"));
}

void UPluginSettingsComponent::ApplyDefaults()
{
    SettingsMap.Add(TEXT("General.PluginVersion"), TEXT("1.0"));
    SettingsMap.Add(TEXT("General.PluginName"), TEXT("GlitchCodeAI"));
    SettingsMap.Add(TEXT("General.bEnableTelemetry"), TEXT("false"));
    SettingsMap.Add(TEXT("General.bEnableLogging"), TEXT("true"));
    SettingsMap.Add(TEXT("General.LogLevel"), TEXT("Info"));
    SettingsMap.Add(TEXT("Save.AutoSaveInterval"), TEXT("300"));
    SettingsMap.Add(TEXT("Save.MaxSaves"), TEXT("10"));
    SettingsMap.Add(TEXT("Save.CloudSyncEnabled"), TEXT("false"));
    SettingsMap.Add(TEXT("Social.MaxChatHistory"), TEXT("200"));
    SettingsMap.Add(TEXT("Social.DefaultChannel"), TEXT("global"));

    UE_LOG(LogPluginSettings, Log, TEXT("PluginSettings: Applied %d default settings"), SettingsMap.Num());
}

FString UPluginSettingsComponent::GetFullConfigPath() const
{
    if (FPaths::IsRelative(ConfigFilePath))
    {
        return FPaths::ProjectDir() / ConfigFilePath;
    }
    return ConfigFilePath;
}

bool UPluginSettingsComponent::SplitLine(const FString& Line, FString& OutKey, FString& OutValue) const
{
    int32 EqIndex;
    if (Line.FindChar(TEXT('='), EqIndex))
    {
        OutKey = Line.Left(EqIndex).TrimStartAndEnd();
        OutValue = Line.Mid(EqIndex + 1).TrimStartAndEnd();
        return !OutKey.IsEmpty();
    }
    return false;
}
