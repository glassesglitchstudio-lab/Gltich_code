#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "Interfaces/IPluginManager.h"
#include "UGlitchCodeAISubsystem.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnResponseReceived, const FString&, Response);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnErrorReceived, const FString&, ErrorMessage);

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
	void SendMessage(const FString& Message);

	UFUNCTION(BlueprintPure, Category = "GlitchCodeAI")
	bool IsRunning() const { return bIsRunning; }

	UPROPERTY(BlueprintAssignable, Category = "GlitchCodeAI")
	FOnResponseReceived OnResponseReceived;

	UPROPERTY(BlueprintAssignable, Category = "GlitchCodeAI")
	FOnErrorReceived OnErrorReceived;

private:
	void SendJSONRPCRequest(const FString& Method, const FString& Params);
	void HandleStdoutData(const FString& Data);
	void ProcessBufferedOutput();

	bool bIsRunning = false;
	bool bRequestPending = false;

	FProcHandle ProcessHandle;
	FRunnableThread* StdoutReaderThread = nullptr;

	FCriticalSection BufferMutex;
	TArray<FString> OutputBuffer;

	int32 RequestIdCounter = 0;

	void CreatePipeHandles(HANDLE& OutReadPipe, HANDLE& OutWritePipe);

	class FStdoutReader : public FRunnable
	{
	public:
		FStdoutReader(UGlitchCodeAISubsystem* InOwner, HANDLE InReadPipe);
		virtual bool Init() override;
		virtual uint32 Run() override;
		virtual void Stop() override;

	private:
		UGlitchCodeAISubsystem* Owner;
		HANDLE ReadPipe;
		FThreadSafeBool bShouldStop;
	};

	FStdoutReader* StdoutReader = nullptr;
};
