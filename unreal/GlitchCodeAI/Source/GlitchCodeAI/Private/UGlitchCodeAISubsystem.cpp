#include "UGlitchCodeAISubsystem.h"
#include "GlitchCodeAI.h"
#include "HAL/PlatformProcess.h"
#include "Misc/Paths.h"
#include "Misc/ConfigCacheIni.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Dom/JsonObject.h"

#if PLATFORM_WINDOWS
#include "Windows/WindowsPlatformMisc.h"
#else
#include <unistd.h>
#include <sys/wait.h>
#endif

// --- FStdoutReader implementation ---

UGlitchCodeAISubsystem::FStdoutReader::FStdoutReader(
	UGlitchCodeAISubsystem* InOwner, void* InReadPipe)
	: Owner(InOwner)
	, ReadPipe(InReadPipe)
	, bShouldStop(false)
{
}

bool UGlitchCodeAISubsystem::FStdoutReader::Init()
{
	return ReadPipe != nullptr;
}

uint32 UGlitchCodeAISubsystem::FStdoutReader::Run()
{
	const int32 BufferSize = 4096;
	TArray<uint8> ReadBuffer;
	ReadBuffer.SetNumUninitialized(BufferSize);

	while (!bShouldStop)
	{
		int32 BytesRead = 0;

#if PLATFORM_WINDOWS
		DWORD WinBytesRead = 0;
		BOOL bSuccess = ReadFile(
			static_cast<HANDLE>(ReadPipe),
			ReadBuffer.GetData(),
			BufferSize - 1,
			&WinBytesRead,
			nullptr
		);
		BytesRead = static_cast<int32>(WinBytesRead);

		if (!bSuccess)
		{
			break;
		}
#else
		ssize_t Result = read(
			reinterpret_cast<intptr_t>(ReadPipe),
			ReadBuffer.GetData(),
			BufferSize - 1
		);

		if (Result < 0)
		{
			break;
		}
		BytesRead = static_cast<int32>(Result);
#endif

		if (BytesRead > 0)
		{
			ReadBuffer[BytesRead] = 0;
			FString Data = FString(UTF8_TO_TCHAR(reinterpret_cast<const ANSICHAR*>(ReadBuffer.GetData())));

			{
				FScopeLock Lock(&Owner->BufferMutex);
				Owner->OutputBuffer.Add(Data);
			}
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

// --- Cross-platform pipe creation ---

void UGlitchCodeAISubsystem::CreatePipeHandles()
{
#if PLATFORM_WINDOWS
	SECURITY_ATTRIBUTES SecurityAttr;
	SecurityAttr.nLength = sizeof(SECURITY_ATTRIBUTES);
	SecurityAttr.bInheritHandle = TRUE;
	SecurityAttr.lpSecurityDescriptor = nullptr;

	HANDLE ReadHandle = nullptr;
	HANDLE WriteHandle = nullptr;

	if (::CreatePipe(&ReadHandle, &WriteHandle, &SecurityAttr, 0))
	{
		SetHandleInformation(ReadHandle, HANDLE_FLAG_INHERIT, 0);
		ReadPipe = static_cast<void*>(ReadHandle);
		WritePipe = static_cast<void*>(WriteHandle);
	}
	else
	{
		UE_LOG(LogGlitchCodeAI, Error, TEXT("Failed to create Windows pipes"));
		ReadPipe = nullptr;
		WritePipe = nullptr;
	}
#else
	int PipeFDs[2] = { -1, -1 };

	if (pipe(PipeFDs) == 0)
	{
		fcntl(PipeFDs[0], F_SETFD, FD_CLOEXEC);
		ReadPipe = reinterpret_cast<void*>(static_cast<intptr_t>(PipeFDs[0]));
		WritePipe = reinterpret_cast<void*>(static_cast<intptr_t>(PipeFDs[1]));
	}
	else
	{
		UE_LOG(LogGlitchCodeAI, Error, TEXT("Failed to create POSIX pipes"));
		ReadPipe = nullptr;
		WritePipe = nullptr;
	}
#endif
}

void UGlitchCodeAISubsystem::ClosePipeHandles()
{
#if PLATFORM_WINDOWS
	if (ReadPipe)
	{
		CloseHandle(static_cast<HANDLE>(ReadPipe));
		ReadPipe = nullptr;
	}
	if (WritePipe)
	{
		CloseHandle(static_cast<HANDLE>(WritePipe));
		WritePipe = nullptr;
	}
#else
	if (ReadPipe)
	{
		close(reinterpret_cast<intptr_t>(ReadPipe));
		ReadPipe = nullptr;
	}
	if (WritePipe)
	{
		close(reinterpret_cast<intptr_t>(WritePipe));
		WritePipe = nullptr;
	}
#endif
}

// --- Settings ---

void UGlitchCodeAISubsystem::LoadSettings()
{
	FString ConfigPath = FPaths::Combine(
		FPaths::ProjectDir(),
		TEXT("Config"),
		TEXT("DefaultGlitchCodeAI.ini")
	);

	if (FPaths::FileExists(ConfigPath))
	{
		GConfig->GetString(
			TEXT("GlitchCodeAI"),
			TEXT("AutoStart"),
			bAutoStart,
			ConfigPath
		);

		GConfig->GetString(
			TEXT("GlitchCodeAI"),
			TEXT("BinaryPath"),
			CustomBinaryPath,
			ConfigPath
		);

		UE_LOG(LogGlitchCodeAI, Log, TEXT("Settings loaded: AutoStart=%s, BinaryPath=%s"),
			bAutoStart ? TEXT("true") : TEXT("false"),
			*CustomBinaryPath);
	}
}

void UGlitchCodeAISubsystem::SaveSettings()
{
	FString ConfigPath = FPaths::Combine(
		FPaths::ProjectDir(),
		TEXT("Config"),
		TEXT("DefaultGlitchCodeAI.ini")
	);

	GConfig->SetString(
		TEXT("GlitchCodeAI"),
		TEXT("AutoStart"),
		bAutoStart ? TEXT("true") : TEXT("false"),
		ConfigPath
	);

	GConfig->SetString(
		TEXT("GlitchCodeAI"),
		TEXT("BinaryPath"),
		*CustomBinaryPath,
		ConfigPath
	);

	GConfig->Flush(false, ConfigPath);
	UE_LOG(LogGlitchCodeAI, Log, TEXT("Settings saved"));
}

// --- Subsystem implementation ---

void UGlitchCodeAISubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);
	UE_LOG(LogGlitchCodeAI, Log, TEXT("GlitchCodeAI subsystem initializing"));

	LoadSettings();

	if (bAutoStart)
	{
		UE_LOG(LogGlitchCodeAI, Log, TEXT("Auto-start enabled, starting CLI..."));
		StartCLI();
	}
	else
	{
		UE_LOG(LogGlitchCodeAI, Log, TEXT("Auto-start disabled"));
		OnConnectionStateChanged.Broadcast(false);
	}
}

void UGlitchCodeAISubsystem::Deinitialize()
{
	StopCLI();
	Super::Deinitialize();
}

FString UGlitchCodeAISubsystem::FindGlitchBinary() const
{
	// 1. Custom path from settings
	if (!CustomBinaryPath.IsEmpty() && FPaths::FileExists(CustomBinaryPath))
	{
		return CustomBinaryPath;
	}

	// 2. Plugin directory
	FString PluginDir = IPluginManager::Get().FindPlugin(TEXT("GlitchCodeAI"))->GetBaseDir();

#if PLATFORM_WINDOWS
	TArray<FString> SearchPaths = {
		FPaths::Combine(PluginDir, TEXT("Binaries"), TEXT("glitch-cli.exe")),
		FPaths::Combine(PluginDir, TEXT("glitch-cli.exe")),
		TEXT("C:/Program Files/GlitchCode/glitch-cli.exe"),
		FPaths::Combine(FPaths::ProjectDir(), TEXT("Plugins/GlitchCodeAI/glitch-cli.exe")),
		FPaths::Combine(FPaths::ProjectDir(), TEXT("ThirdParty/GlitchCode/glitch-cli.exe"))
	};
#elif PLATFORM_MAC
	TArray<FString> SearchPaths = {
		FPaths::Combine(PluginDir, TEXT("Binaries"), TEXT("glitch")),
		FPaths::Combine(PluginDir, TEXT("glitch")),
		TEXT("/usr/local/bin/glitch"),
		TEXT("/opt/homebrew/bin/glitch"),
		FPaths::Combine(FPaths::ProjectDir(), TEXT("Plugins/GlitchCodeAI/glitch")),
		FPaths::Combine(FPaths::ProjectDir(), TEXT("ThirdParty/GlitchCode/glitch"))
	};
#else
	TArray<FString> SearchPaths = {
		FPaths::Combine(PluginDir, TEXT("Binaries"), TEXT("glitch")),
		FPaths::Combine(PluginDir, TEXT("glitch")),
		TEXT("/usr/local/bin/glitch"),
		TEXT("/usr/bin/glitch"),
		FPaths::Combine(FPaths::ProjectDir(), TEXT("Plugins/GlitchCodeAI/glitch")),
		FPaths::Combine(FPaths::ProjectDir(), TEXT("ThirdParty/GlitchCode/glitch"))
	};
#endif

	// 3. PATH environment variable
	FString PathEnv;
	FPlatformMisc::GetEnvironmentVariable(TEXT("PATH"), PathEnv);
	TArray<FString> Paths;
	ParseIntoArray(Paths, *PathEnv, OS_PATH_SEPARATOR);
	for (const FString& Path : Paths)
	{
#if PLATFORM_WINDOWS
		SearchPaths.Add(FPaths::Combine(Path, TEXT("glitch-cli.exe")));
#else
		SearchPaths.Add(FPaths::Combine(Path, TEXT("glitch")));
#endif
	}

	// Find first existing binary
	for (const FString& Path : SearchPaths)
	{
		if (FPaths::FileExists(Path))
		{
			return Path;
		}
	}

	return FString();
}

void UGlitchCodeAISubsystem::StartCLI()
{
	if (bIsRunning)
	{
		UE_LOG(LogGlitchCodeAI, Warning, TEXT("CLI is already running"));
		return;
	}

	FString CLIPath = FindGlitchBinary();

	if (CLIPath.IsEmpty())
	{
		UE_LOG(LogGlitchCodeAI, Error, TEXT("Could not find glitch binary"));
		OnErrorReceived.Broadcast(TEXT("Could not find glitch binary. Make sure Glitch Code is installed."));
		OnConnectionStateChanged.Broadcast(false);
		return;
	}

	CreatePipeHandles();

	if (!ReadPipe || !WritePipe)
	{
		UE_LOG(LogGlitchCodeAI, Error, TEXT("Failed to create pipes for CLI communication"));
		OnErrorReceived.Broadcast(TEXT("Failed to create pipes for CLI communication"));
		OnConnectionStateChanged.Broadcast(false);
		return;
	}

	FString WorkingDir = FPaths::GetPath(CLIPath);
	FString CommandLine = TEXT("--transport stdio");

	ProcessHandle = FPlatformProcess::CreateProc(
		*CLIPath,
		*CommandLine,
		false,
		true,
		false,
		nullptr,
		*WorkingDir,
		EShowWindow::Hide,
		nullptr,
		nullptr
	);

	if (ProcessHandle.IsValid())
	{
		bIsRunning = true;
		UE_LOG(LogGlitchCodeAI, Log, TEXT("CLI started: %s (PID: %d)"), *CLIPath, ProcessHandle.GetId());

		StdoutReader = new FStdoutReader(this, ReadPipe);
		StdoutReaderThread = FRunnableThread::Create(
			StdoutReader,
			TEXT("GlitchCodeStdoutReader"),
			0,
			TPri_BelowNormal
		);

		FTimerHandle TimerHandle;
		GetWorld()->GetTimerManager().SetTimer(TimerHandle, [this]()
		{
			ProcessBufferedOutput();
		}, 0.1f, true);

		OnConnectionStateChanged.Broadcast(true);
		OnResponseReceived.Broadcast(TEXT("Connected to Glitch Code CLI"));
	}
	else
	{
		ClosePipeHandles();
		UE_LOG(LogGlitchCodeAI, Error, TEXT("Failed to start CLI: %s"), *CLIPath);
		OnErrorReceived.Broadcast(FString::Printf(TEXT("Failed to start CLI: %s"), *CLIPath));
		OnConnectionStateChanged.Broadcast(false);
	}
}

void UGlitchCodeAISubsystem::StopCLI()
{
	if (!bIsRunning)
	{
		return;
	}

	bIsRunning = false;

	if (StdoutReader)
	{
		StdoutReader->Stop();
	}

	if (StdoutReaderThread)
	{
		StdoutReaderThread->WaitForCompletion();
		delete StdoutReaderThread;
		StdoutReaderThread = nullptr;
	}

	delete StdoutReader;
	StdoutReader = nullptr;

	if (ProcessHandle.IsValid())
	{
		FPlatformProcess::TerminateProc(ProcessHandle);
		FPlatformProcess::CloseProc(ProcessHandle);
		ProcessHandle.Reset();
	}

	ClosePipeHandles();

	OnConnectionStateChanged.Broadcast(false);
	UE_LOG(LogGlitchCodeAI, Log, TEXT("CLI stopped"));
}

void UGlitchCodeAISubsystem::RestartCLI()
{
	StopCLI();
	StartCLI();
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

void UGlitchCodeAISubsystem::SendToStdin(const FString& Message)
{
	if (!WritePipe) return;

	FTCHARToUTF8 Converter(*Message);
	uint32 BytesWritten = 0;
	FPlatformProcess::WritePipe(WritePipe, Converter.Get(), &BytesWritten);
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

	SendToStdin(JsonString + TEXT("\n"));
}

void UGlitchCodeAISubsystem::SendJSONRPCRequest(const FString& Method, const TSharedPtr<FJsonObject>& Params)
{
	TSharedPtr<FJsonObject> JsonRpc = MakeShareable(new FJsonObject);
	JsonRpc->SetStringField(TEXT("jsonrpc"), TEXT("2.0"));
	JsonRpc->SetNumberField(TEXT("id"), ++RequestIdCounter);
	JsonRpc->SetStringField(TEXT("method"), Method);
	JsonRpc->SetObjectField(TEXT("params"), Params);

	FString JsonString;
	TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&JsonString);
	FJsonSerializer::Serialize(JsonRpc.ToSharedRef(), Writer);

	SendToStdin(JsonString + TEXT("\n"));
}

// --- Tool functions ---

void UGlitchCodeAISubsystem::DeleteActor(const FString& ActorName)
{
	TSharedPtr<FJsonObject> Params = MakeShareable(new FJsonObject);
	Params->SetStringField(TEXT("actorName"), ActorName);
	SendJSONRPCRequest(TEXT("ue5.delete-actor"), Params);
}

void UGlitchCodeAISubsystem::MoveActor(const FString& ActorName, float X, float Y, float Z)
{
	TSharedPtr<FJsonObject> Params = MakeShareable(new FJsonObject);
	Params->SetStringField(TEXT("actorName"), ActorName);
	Params->SetNumberField(TEXT("x"), X);
	Params->SetNumberField(TEXT("y"), Y);
	Params->SetNumberField(TEXT("z"), Z);
	SendJSONRPCRequest(TEXT("ue5.move-actor"), Params);
}

void UGlitchCodeAISubsystem::SetMaterial(const FString& ActorName, const FString& MaterialPath, int32 SlotIndex)
{
	TSharedPtr<FJsonObject> Params = MakeShareable(new FJsonObject);
	Params->SetStringField(TEXT("actorName"), ActorName);
	Params->SetStringField(TEXT("materialPath"), MaterialPath);
	Params->SetNumberField(TEXT("slotIndex"), SlotIndex);
	SendJSONRPCRequest(TEXT("ue5.set-material"), Params);
}

void UGlitchCodeAISubsystem::OpenLevel(const FString& LevelPath)
{
	TSharedPtr<FJsonObject> Params = MakeShareable(new FJsonObject);
	Params->SetStringField(TEXT("levelPath"), LevelPath);
	SendJSONRPCRequest(TEXT("ue5.open-level"), Params);
}

void UGlitchCodeAISubsystem::PlayInEditor(int32 Mode)
{
	TSharedPtr<FJsonObject> Params = MakeShareable(new FJsonObject);
	Params->SetNumberField(TEXT("mode"), Mode);
	SendJSONRPCRequest(TEXT("ue5.play"), Params);
}

void UGlitchCodeAISubsystem::StopPlay()
{
	TSharedPtr<FJsonObject> Params = MakeShareable(new FJsonObject);
	SendJSONRPCRequest(TEXT("ue5.stop"), Params);
}

void UGlitchCodeAISubsystem::SelectActor(const FString& ActorName)
{
	TSharedPtr<FJsonObject> Params = MakeShareable(new FJsonObject);
	Params->SetStringField(TEXT("actorName"), ActorName);
	SendJSONRPCRequest(TEXT("ue5.select-actor"), Params);
}

void UGlitchCodeAISubsystem::Undo(int32 Steps)
{
	TSharedPtr<FJsonObject> Params = MakeShareable(new FJsonObject);
	Params->SetNumberField(TEXT("steps"), Steps);
	SendJSONRPCRequest(TEXT("ue5.undo"), Params);
}

void UGlitchCodeAISubsystem::Redo(int32 Steps)
{
	TSharedPtr<FJsonObject> Params = MakeShareable(new FJsonObject);
	Params->SetNumberField(TEXT("steps"), Steps);
	SendJSONRPCRequest(TEXT("ue5.redo"), Params);
}

void UGlitchCodeAISubsystem::GetContext()
{
	TSharedPtr<FJsonObject> Params = MakeShareable(new FJsonObject);
	SendJSONRPCRequest(TEXT("ue5.context"), Params);
}

// --- Output handling ---

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
			if (JsonResponse->HasField(TEXT("id")))
			{
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
