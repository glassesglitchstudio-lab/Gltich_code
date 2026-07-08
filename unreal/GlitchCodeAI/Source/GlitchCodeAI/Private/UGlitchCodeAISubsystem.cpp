#include "UGlitchCodeAISubsystem.h"
#include "GlitchCodeAI.h"
#include "HAL/PlatformProcess.h"
#include "Misc/Paths.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Dom/JsonObject.h"

// --- FStdoutReader implementation ---

UGlitchCodeAISubsystem::FStdoutReader::FStdoutReader(
	UGlitchCodeAISubsystem* InOwner, HANDLE InReadPipe)
	: Owner(InOwner)
	, ReadPipe(InReadPipe)
	, bShouldStop(false)
{
}

bool UGlitchCodeAISubsystem::FStdoutReader::Init()
{
	return ReadPipe != INVALID_HANDLE_VALUE;
}

uint32 UGlitchCodeAISubsystem::FStdoutReader::Run()
{
	const int32 BufferSize = 4096;
	TArray<uint8> ReadBuffer;
	ReadBuffer.SetNumUninitialized(BufferSize);

	while (!bShouldStop)
	{
		DWORD BytesRead = 0;
		BOOL bSuccess = ReadFile(ReadPipe, ReadBuffer.GetData(), BufferSize - 1, &BytesRead, nullptr);

		if (bSuccess && BytesRead > 0)
		{
			ReadBuffer[BytesRead] = 0;
			FString Data = FString(UTF8_TO_TCHAR(reinterpret_cast<const ANSICHAR*>(ReadBuffer.GetData())));

			{
				FScopeLock Lock(&Owner->BufferMutex);
				Owner->OutputBuffer.Add(Data);
			}
		}
		else if (!bSuccess)
		{
			break;
		}
		else
		{
			FPlatformProcess::Sleep(0.01f);
		}
	}

	return 0;
}

void UGlitchCodeAISubsystem::FStdoutReader::Stop()
{
	bShouldStop = true;
}

// --- Subsystem implementation ---

void UGlitchCodeAISubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);
	UE_LOG(LogGlitchCodeAI, Log, TEXT("GlitchCodeAI subsystem initialized"));
}

void UGlitchCodeAISubsystem::Deinitialize()
{
	StopCLI();
	Super::Deinitialize();
}

void UGlitchCodeAISubsystem::CreatePipeHandles(HANDLE& OutReadPipe, HANDLE& OutWritePipe)
{
	SECURITY_ATTRIBUTES SecurityAttr;
	SecurityAttr.nLength = sizeof(SECURITY_ATTRIBUTES);
	SecurityAttr.bInheritHandle = TRUE;
	SecurityAttr.lpSecurityDescriptor = nullptr;

	CreatePipe(&OutReadPipe, &OutWritePipe, &SecurityAttr, 0);

	// The read handle should not be inherited by the child process
	SetHandleInformation(OutReadPipe, HANDLE_FLAG_INHERIT, 0);
}

void UGlitchCodeAISubsystem::StartCLI()
{
	if (bIsRunning)
	{
		UE_LOG(LogGlitchCodeAI, Warning, TEXT("CLI is already running"));
		return;
	}

	FString CLIPath = FPaths::Combine(
		FPaths::ProjectDir(),
		TEXT("Binaries"),
		TEXT("glitch-cli.exe")
	);

	if (!FPaths::FileExists(CLIPath))
	{
		// Fallback: try common locations
		TArray<FString> SearchPaths = {
			TEXT("C:/Program Files/GlitchCode/glitch-cli.exe"),
			FPaths::Combine(FPaths::ProjectDir(), TEXT("Plugins/GlitchCodeAI/glitch-cli.exe")),
			FPaths::Combine(FPaths::ProjectDir(), TEXT("ThirdParty/GlitchCode/glitch-cli.exe"))
		};

		for (const FString& Path : SearchPaths)
		{
			if (FPaths::FileExists(Path))
			{
				CLIPath = Path;
				break;
			}
		}
	}

	HANDLE ReadPipe, WritePipe;
	CreatePipeHandles(ReadPipe, WritePipe);

	FString WorkingDir = FPaths::GetPath(CLIPath);
	FString CommandLine = FString::Printf(TEXT("\"%s\" --transport stdio"), *CLIPath);

	STARTUPINFO StartupInfo = {};
	StartupInfo.cb = sizeof(STARTUPINFO);
	StartupInfo.hStdOutput = WritePipe;
	StartupInfo.hStdError = WritePipe;
	StartupInfo.dwFlags = STARTF_USESTDHANDLES;

	ProcessHandle = FPlatformProcess::CreateProc(
		*CLIPath,
		*CommandLine,
		false,
		true,    // bInheritHandles
		false,   // bInheritHandlesFromParent (deprecated, using legacy)
		nullptr, // OutProcessID
		*WorkingDir,
		EShowWindow::Show,
		nullptr, // OutThreadHandle
		nullptr  // OutProcessId
	);

	// Close write end in parent — child inherits it
	CloseHandle(WritePipe);

	if (ProcessHandle.IsValid())
	{
		bIsRunning = true;
		UE_LOG(LogGlitchCodeAI, Log, TEXT("CLI started: %s"), *CLIPath);

		StdoutReader = new FStdoutReader(this, ReadPipe);
		StdoutReaderThread = FRunnableThread::Create(
			StdoutReader,
			TEXT("GlitchCodeStdoutReader"),
			0,
			TPri_BelowNormal
		);

		// Start polling for responses
		FTimerHandle TimerHandle;
		GetWorld()->GetTimerManager().SetTimer(TimerHandle, [this]()
		{
			ProcessBufferedOutput();
		}, 0.1f, true);
	}
	else
	{
		CloseHandle(ReadPipe);
		UE_LOG(LogGlitchCodeAI, Error, TEXT("Failed to start CLI: %s"), *CLIPath);
		OnErrorReceived.Broadcast(FString::Printf(TEXT("Failed to start CLI: %s"), *CLIPath));
	}
}

void UGlitchCodeAISubsystem::StopCLI()
{
	if (!bIsRunning)
	{
		return;
	}

	bIsRunning = false;

	if (StdoutReaderThread)
	{
		StdoutReaderThread->WaitForCompletion();
		delete StdoutReaderThread;
		StdoutReaderThread = nullptr;
		StdoutReader = nullptr;
	}

	if (ProcessHandle.IsValid())
	{
		FPlatformProcess::TerminateProc(ProcessHandle);
		FPlatformProcess::CloseProc(ProcessHandle);
		ProcessHandle.Reset();
	}

	UE_LOG(LogGlitchCodeAI, Log, TEXT("CLI stopped"));
}

void UGlitchCodeAISubsystem::SendMessage(const FString& Message)
{
	if (!bIsRunning)
	{
		UE_LOG(LogGlitchCodeAI, Warning, TEXT("CLI is not running. Call StartCLI() first."));
		OnErrorReceived.Broadcast(TEXT("CLI is not running. Call StartCLI() first."));
		return;
	}

	SendJSONRPCRequest(TEXT("chat.send"), Message);
	UE_LOG(LogGlitchCodeAI, Log, TEXT("Sent message: %s"), *Message);
}

void UGlitchCodeAISubsystem::SendJSONRPCRequest(const FString& Method, const FString& Params)
{
	TSharedPtr<FJsonObject> JsonRpc = MakeShareable(new FJsonObject);
	JsonRpc->SetStringField(TEXT("jsonrpc"), TEXT("2.0"));
	JsonRpc->SetNumberField(TEXT("id"), ++RequestIdCounter);
	JsonRpc->SetStringField(TEXT("method"), Method);

	TSharedPtr<FJsonObject> ParamsObj = MakeShareable(new FJsonObject);
	ParamsObj->SetStringField(TEXT("content"), Params);
	JsonRpc->SetObjectField(TEXT("params"), ParamsObj);

	FString JsonString;
	TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&JsonString);
	FJsonSerializer::Serialize(JsonRpc.ToSharedRef(), Writer);

	// Append newline as delimiter for stdio transport
	JsonString += TEXT("\n");

	FString FullMessage = JsonString;

	FPlatformProcess::WriteProc(
		ProcessHandle,
		*TCHAR_TO_UTF8(*FullMessage),
		FullMessage.Len(),
		nullptr,
		nullptr
	);
}

void UGlitchCodeAISubsystem::HandleStdoutData(const FString& Data)
{
	TArray<FString> Lines;
	Data.ParseIntoArrayLines(Lines);

	for (const FString& Line : Lines)
	{
		if (Line.IsEmpty())
		{
			continue;
		}

		TSharedPtr<FJsonObject> JsonResponse;
		TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Line);

		if (FJsonSerializer::Deserialize(Reader, JsonResponse) && JsonResponse.IsValid())
		{
			// Check if this is a response (has "id" field) or notification (no "id")
			if (JsonResponse->HasField(TEXT("id")))
			{
				// Response to our request
				if (JsonResponse->HasField(TEXT("result")))
				{
					TSharedPtr<FJsonObject> Result = JsonResponse->GetObjectField(TEXT("result"));
					if (Result.IsValid() && Result->HasField(TEXT("content")))
					{
						FString Content = Result->GetStringField(TEXT("content"));

						AsyncTask(ENamedThreads::GameThread, [this, Content]()
						{
							OnResponseReceived.Broadcast(Content);
						});
					}
				}
				else if (JsonResponse->HasField(TEXT("error")))
				{
					TSharedPtr<FJsonObject> Error = JsonResponse->GetObjectField(TEXT("error"));
					FString ErrorMessage = Error->GetStringField(TEXT("message"));

					AsyncTask(ENamedThreads::GameThread, [this, ErrorMessage]()
					{
						OnErrorReceived.Broadcast(ErrorMessage);
					});
				}
			}
			else
			{
				// Server-initiated notification (e.g., progress updates)
				if (JsonResponse->HasField(TEXT("method")))
				{
					FString Method = JsonResponse->GetStringField(TEXT("method"));
					if (Method == TEXT("chat.progress"))
					{
						TSharedPtr<FJsonObject> Params = JsonResponse->GetObjectField(TEXT("params"));
						if (Params.IsValid() && Params->HasField(TEXT("chunk")))
						{
							FString Chunk = Params->GetStringField(TEXT("chunk"));

							AsyncTask(ENamedThreads::GameThread, [this, Chunk]()
							{
								OnResponseReceived.Broadcast(Chunk);
							});
						}
					}
				}
			}
		}
	}
}

void UGlitchCodeAISubsystem::ProcessBufferedOutput()
{
	if (!bIsRunning)
	{
		return;
	}

	TArray<FString> LocalBuffer;
	{
		FScopeLock Lock(&BufferMutex);
		if (OutputBuffer.Num() == 0)
		{
			return;
		}
		LocalBuffer = MoveTemp(OutputBuffer);
		OutputBuffer.Reset();
	}

	for (const FString& Data : LocalBuffer)
	{
		HandleStdoutData(Data);
	}
}
