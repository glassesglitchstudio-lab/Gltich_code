#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "Interfaces/IPluginManager.h"
#include "UGlitchCodeAISubsystem.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnResponseReceived, const FString&, Response);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnErrorReceived, const FString&, ErrorMessage);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnConnectionStateChanged, bool, bConnected);

UCLASS()
class GLITCHCODEAI_API UGlitchCodeAISubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;
	virtual void Deinitialize() override;

	UFUNCTION(BlueprintCallable, Category = "GlitchCodeAI")
	void StartCLI();

	UFUNCTION(BlueprintCallable, Category = "GlitchCodeAI")
	void StopCLI();

	UFUNCTION(BlueprintCallable, Category = "GlitchCodeAI")
	void RestartCLI();

	UFUNCTION(BlueprintCallable, Category = "GlitchCodeAI")
	void SendMessage(const FString& Message);

	UFUNCTION(BlueprintPure, Category = "GlitchCodeAI")
	bool IsRunning() const { return bIsRunning; }

	// Settings
	UFUNCTION(BlueprintCallable, Category = "GlitchCodeAI|Settings")
	void SetAutoStart(bool bEnable) { bAutoStart = bEnable; SaveSettings(); }

	UFUNCTION(BlueprintPure, Category = "GlitchCodeAI|Settings")
	bool GetAutoStart() const { return bAutoStart; }

	UFUNCTION(BlueprintCallable, Category = "GlitchCodeAI|Settings")
	void SetBinaryPath(const FString& Path) { CustomBinaryPath = Path; SaveSettings(); }

	UFUNCTION(BlueprintPure, Category = "GlitchCodeAI|Settings")
	FString GetBinaryPath() const { return CustomBinaryPath; }

	// UE5 tool functions
	UFUNCTION(BlueprintCallable, Category = "GlitchCodeAI")
	void DeleteActor(const FString& ActorName);

	UFUNCTION(BlueprintCallable, Category = "GlitchCodeAI")
	void MoveActor(const FString& ActorName, float X, float Y, float Z);

	UFUNCTION(BlueprintCallable, Category = "GlitchCodeAI")
	void SetMaterial(const FString& ActorName, const FString& MaterialPath, int32 SlotIndex);

	UFUNCTION(BlueprintCallable, Category = "GlitchCodeAI")
	void OpenLevel(const FString& LevelPath);

	UFUNCTION(BlueprintCallable, Category = "GlitchCodeAI")
	void PlayInEditor(int32 Mode);

	UFUNCTION(BlueprintCallable, Category = "GlitchCodeAI")
	void StopPlay();

	UFUNCTION(BlueprintCallable, Category = "GlitchCodeAI")
	void SelectActor(const FString& ActorName);

	UFUNCTION(BlueprintCallable, Category = "GlitchCodeAI")
	void Undo(int32 Steps);

	UFUNCTION(BlueprintCallable, Category = "GlitchCodeAI")
	void Redo(int32 Steps);

	UFUNCTION(BlueprintCallable, Category = "GlitchCodeAI")
	void GetContext();

	// Delegates
	UPROPERTY(BlueprintAssignable, Category = "GlitchCodeAI")
	FOnResponseReceived OnResponseReceived;

	UPROPERTY(BlueprintAssignable, Category = "GlitchCodeAI")
	FOnErrorReceived OnErrorReceived;

	UPROPERTY(BlueprintAssignable, Category = "GlitchCodeAI")
	FOnConnectionStateChanged OnConnectionStateChanged;

private:
	void SendJSONRPCRequest(const FString& Method, const FString& Params);
	void SendJSONRPCRequest(const FString& Method, const TSharedPtr<FJsonObject>& Params);
	void SendToStdin(const FString& Message);
	void HandleStdoutData(const FString& Data);
	void ProcessBufferedOutput();
	FString FindGlitchBinary() const;
	void LoadSettings();
	void SaveSettings();

	bool bIsRunning = false;
	bool bAutoStart = true;
	FString CustomBinaryPath;

	FProcHandle ProcessHandle;
	FRunnableThread* StdoutReaderThread = nullptr;

	FCriticalSection BufferMutex;
	TArray<FString> OutputBuffer;

	int32 RequestIdCounter = 0;

	void* ReadPipe = nullptr;
	void* WritePipe = nullptr;

	void CreatePipeHandles();
	void ClosePipeHandles();

	class FStdoutReader : public FRunnable
	{
	public:
		FStdoutReader(UGlitchCodeAISubsystem* InOwner, void* InReadPipe);
		virtual bool Init() override;
		virtual uint32 Run() override;
		virtual void Stop() override;

	private:
		UGlitchCodeAISubsystem* Owner;
		void* ReadPipe;
		FThreadSafeBool bShouldStop;
	};

	FStdoutReader* StdoutReader = nullptr;
};
