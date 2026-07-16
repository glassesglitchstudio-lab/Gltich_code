#include "UPluginTelemetryComponent.h"
#include "Misc/Paths.h"
#include "Misc/FileHelper.h"
#include "HAL/PlatformFileManager.h"
#include "HAL/PlatformMemory.h"
#include "Misc/DateTime.h"

DEFINE_LOG_CATEGORY_STATIC(LogTelemetry, Log, All);

UPluginTelemetryComponent::UPluginTelemetryComponent()
{
    PrimaryComponentTick.bCanEverTick = true;
    PrimaryComponentTick.TickInterval = 0.0f; // Tick every frame when capturing
}

void UPluginTelemetryComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

    if (!bIsCapturing) return;

    TimeSinceLastCapture += DeltaTime;

    if (TimeSinceLastCapture >= CaptureInterval)
    {
        CaptureFrame();
        TimeSinceLastCapture = 0.0f;
    }
}

void UPluginTelemetryComponent::StartCapture()
{
    if (bIsCapturing)
    {
        UE_LOG(LogTelemetry, Warning, TEXT("Telemetry: Already capturing"));
        return;
    }

    bIsCapturing = true;
    TimeSinceLastCapture = 0.0f;
    CaptureStartTime = FPlatformTime::ToMilliseconds(FPlatformTime::Cycles64()) / 1000.0f;

    UE_LOG(LogTelemetry, Log, TEXT("Telemetry: Capture started (interval=%.2fs)"), CaptureInterval);
}

void UPluginTelemetryComponent::StopCapture()
{
    if (!bIsCapturing) return;

    bIsCapturing = false;
    UE_LOG(LogTelemetry, Log, TEXT("Telemetry: Capture stopped, %d frames recorded"), CapturedFrames.Num());
}

FTelmetryFrameData UPluginTelemetryComponent::CaptureFrame()
{
    FTelmetryFrameData FrameData;
    
    FrameData.Timestamp = FPlatformTime::ToMilliseconds(FPlatformTime::Cycles64()) / 1000.0f;
    FrameData.FPS = CalculateFPS(GetWorld()->GetDeltaSeconds());
    FrameData.FrameTime = GetWorld()->GetDeltaSeconds() * 1000.0f; // Convert to ms
    FrameData.MemoryUsed = GetMemoryUsed();
    FrameData.MemoryPeak = GetMemoryPeak();
    FrameData.MemoryAvailable = GetMemoryAvailable();

    CapturedFrames.Add(FrameData);

    // Trim if over max
    while (CapturedFrames.Num() > MaxFrames)
    {
        CapturedFrames.RemoveAt(0);
    }

    OnTelemetryCapture.Broadcast(TEXT("frame"));
    return FrameData;
}

FTlemetrySummary UPluginTelemetryComponent::GetFPSReport() const
{
    FTlemetrySummary Summary;

    if (CapturedFrames.Num() == 0) return Summary;

    float TotalFPS = 0.0f;
    float MinFPS = MAX_FLT;
    float MaxFPS = -MAX_FLT;
    int64 TotalMemory = 0;
    int64 PeakMemory = 0;

    for (const FTelmetryFrameData& Frame : CapturedFrames)
    {
        TotalFPS += Frame.FPS;
        MinFPS = FMath::Min(MinFPS, Frame.FPS);
        MaxFPS = FMath::Max(MaxFPS, Frame.FPS);
        TotalMemory += Frame.MemoryUsed;
        PeakMemory = FMath::Max(PeakMemory, Frame.MemoryPeak);
    }

    Summary.AvgFPS = TotalFPS / CapturedFrames.Num();
    Summary.MinFPS = (MinFPS == MAX_FLT) ? 0.0f : MinFPS;
    Summary.MaxFPS = (MaxFPS == -MAX_FLT) ? 0.0f : MaxFPS;
    Summary.AvgMemoryUsed = TotalMemory / CapturedFrames.Num();
    Summary.PeakMemoryUsed = PeakMemory;
    Summary.TotalFrames = CapturedFrames.Num();

    if (CapturedFrames.Num() >= 2)
    {
        Summary.CaptureDuration = CapturedFrames.Last().Timestamp - CapturedFrames.First().Timestamp;
    }

    return Summary;
}

FString UPluginTelemetryComponent::GetMemoryReport() const
{
    FPlatformMemoryStats Stats = FPlatformMemory::GetStats();

    FString Report = FString::Printf(
        TEXT("Memory Report:\n")
        TEXT("  Used Physical: %lld MB\n")
        TEXT("  Available Physical: %lld MB\n")
        TEXT("  Peak Physical: %lld MB\n")
        TEXT("  Used Virtual: %lld MB\n")
        TEXT("  Available Virtual: %lld MB\n"),
        Stats.UsedPhysical / (1024 * 1024),
        Stats.AvailablePhysical / (1024 * 1024),
        Stats.PeakUsedPhysical / (1024 * 1024),
        Stats.UsedVirtual / (1024 * 1024),
        Stats.AvailableVirtual / (1024 * 1024)
    );

    return Report;
}

bool UPluginTelemetryComponent::ExportToCsv(const FString& FilePath) const
{
    FString Dir = FPaths::GetPath(FilePath);
    IFileManager& FileManager = IFileManager::Get();
    if (!FileManager.DirectoryExists(*Dir))
    {
        FileManager.MakeDirectory(*Dir, true);
    }

    FString Content = TEXT("Timestamp,FPS,FrameTime,MemoryUsed,MemoryPeak,MemoryAvailable\n");

    for (const FTelmetryFrameData& Frame : CapturedFrames)
    {
        Content += FString::Printf(TEXT("%.3f,%.2f,%.3f,%lld,%lld,%lld\n"),
            Frame.Timestamp, Frame.FPS, Frame.FrameTime,
            Frame.MemoryUsed, Frame.MemoryPeak, Frame.MemoryAvailable);
    }

    bool bSuccess = FFileHelper::SaveStringToFile(Content, *FilePath);

    if (bSuccess)
    {
        UE_LOG(LogTelemetry, Log, TEXT("Telemetry: Exported %d frames to CSV '%s'"), 
            CapturedFrames.Num(), *FilePath);
    }

    OnTelemetryExported.Broadcast(bSuccess);
    return bSuccess;
}

bool UPluginTelemetryComponent::ExportToJson(const FString& FilePath) const
{
    FString Dir = FPaths::GetPath(FilePath);
    IFileManager& FileManager = IFileManager::Get();
    if (!FileManager.DirectoryExists(*Dir))
    {
        FileManager.MakeDirectory(*Dir, true);
    }

    FString Content = TEXT("[\n");

    for (int32 i = 0; i < CapturedFrames.Num(); ++i)
    {
        const FTelmetryFrameData& Frame = CapturedFrames[i];
        Content += FString::Printf(
            TEXT("  {\"Timestamp\":%.3f,\"FPS\":%.2f,\"FrameTime\":%.3f,\"MemoryUsed\":%lld,\"MemoryPeak\":%lld,\"MemoryAvailable\":%lld}%s\n"),
            Frame.Timestamp, Frame.FPS, Frame.FrameTime,
            Frame.MemoryUsed, Frame.MemoryPeak, Frame.MemoryAvailable,
            (i < CapturedFrames.Num() - 1) ? TEXT(",") : TEXT("")
        );
    }

    Content += TEXT("]\n");

    bool bSuccess = FFileHelper::SaveStringToFile(Content, *FilePath);

    if (bSuccess)
    {
        UE_LOG(LogTelemetry, Log, TEXT("Telemetry: Exported %d frames to JSON '%s'"), 
            CapturedFrames.Num(), *FilePath);
    }

    OnTelemetryExported.Broadcast(bSuccess);
    return bSuccess;
}

void UPluginTelemetryComponent::ClearData()
{
    CapturedFrames.Empty();
    UE_LOG(LogTelemetry, Log, TEXT("Telemetry: Data cleared"));
}

float UPluginTelemetryComponent::CalculateFPS(float DeltaTime) const
{
    return (DeltaTime > 0.0f) ? (1.0f / DeltaTime) : 0.0f;
}

int64 UPluginTelemetryComponent::GetMemoryUsed() const
{
    FPlatformMemoryStats Stats = FPlatformMemory::GetStats();
    return Stats.UsedPhysical;
}

int64 UPluginTelemetryComponent::GetMemoryPeak() const
{
    FPlatformMemoryStats Stats = FPlatformMemory::GetStats();
    return Stats.PeakUsedPhysical;
}

int64 UPluginTelemetryComponent::GetMemoryAvailable() const
{
    FPlatformMemoryStats Stats = FPlatformMemory::GetStats();
    return Stats.AvailablePhysical;
}
