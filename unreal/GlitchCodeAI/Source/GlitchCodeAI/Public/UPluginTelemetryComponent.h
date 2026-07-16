#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "UPluginTelemetryComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnTelemetryCapture, const FString&, MetricName);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnTelemetryExported, bool, bSuccess);

USTRUCT(BlueprintType)
struct FTelmetryFrameData
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly)
    float Timestamp = 0.0f;

    UPROPERTY(BlueprintReadOnly)
    float FPS = 0.0f;

    UPROPERTY(BlueprintReadOnly)
    float FrameTime = 0.0f;

    UPROPERTY(BlueprintReadOnly)
    int64 MemoryUsed = 0;

    UPROPERTY(BlueprintReadOnly)
    int64 MemoryPeak = 0;

    UPROPERTY(BlueprintReadOnly)
    int64 MemoryAvailable = 0;
};

USTRUCT(BlueprintType)
struct FTlemetrySummary
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly)
    float AvgFPS = 0.0f;

    UPROPERTY(BlueprintReadOnly)
    float MinFPS = 0.0f;

    UPROPERTY(BlueprintReadOnly)
    float MaxFPS = 0.0f;

    UPROPERTY(BlueprintReadOnly)
    int64 AvgMemoryUsed = 0;

    UPROPERTY(BlueprintReadOnly)
    int64 PeakMemoryUsed = 0;

    UPROPERTY(BlueprintReadOnly)
    int32 TotalFrames = 0;

    UPROPERTY(BlueprintReadOnly)
    float CaptureDuration = 0.0f;
};

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class GLITCHCODEAI_API UPluginTelemetryComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UPluginTelemetryComponent();

    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

    UFUNCTION(BlueprintCallable, Category = "Plugin|Telemetry")
    void StartCapture();

    UFUNCTION(BlueprintCallable, Category = "Plugin|Telemetry")
    void StopCapture();

    UFUNCTION(BlueprintCallable, Category = "Plugin|Telemetry")
    FTelmetryFrameData CaptureFrame();

    UFUNCTION(BlueprintCallable, Category = "Plugin|Telemetry")
    FTlemetrySummary GetFPSReport() const;

    UFUNCTION(BlueprintCallable, Category = "Plugin|Telemetry")
    FString GetMemoryReport() const;

    UFUNCTION(BlueprintCallable, Category = "Plugin|Telemetry")
    bool ExportToCsv(const FString& FilePath) const;

    UFUNCTION(BlueprintCallable, Category = "Plugin|Telemetry")
    bool ExportToJson(const FString& FilePath) const;

    UFUNCTION(BlueprintCallable, Category = "Plugin|Telemetry")
    void ClearData();

    UFUNCTION(BlueprintPure, Category = "Plugin|Telemetry")
    bool IsCapturing() const { return bIsCapturing; }

    UFUNCTION(BlueprintPure, Category = "Plugin|Telemetry")
    int32 GetFrameCount() const { return CapturedFrames.Num(); }

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Plugin|Telemetry", meta = (ClampMin = "0.01"))
    float CaptureInterval = 0.5f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Plugin|Telemetry", meta = (ClampMin = "10"))
    int32 MaxFrames = 10000;

    UPROPERTY(BlueprintAssignable)
    FOnTelemetryCapture OnTelemetryCapture;

    UPROPERTY(BlueprintAssignable)
    FOnTelemetryExported OnTelemetryExported;

protected:
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Plugin|Telemetry")
    TArray<FTelmetryFrameData> CapturedFrames;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Plugin|Telemetry")
    bool bIsCapturing = false;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Plugin|Telemetry")
    float TimeSinceLastCapture = 0.0f;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Plugin|Telemetry")
    float CaptureStartTime = 0.0f;

private:
    float CalculateFPS(float DeltaTime) const;
    int64 GetMemoryUsed() const;
    int64 GetMemoryPeak() const;
    int64 GetMemoryAvailable() const;
};
