#include "GlitchCodeAIPanel.h"
#include "GlitchCodeAI.h"
#include "UGlitchCodeAISubsystem.h"
#include "Widgets/Input/SButton.h"
#include "Widgets/Input/SEditableTextBox.h"
#include "Widgets/Input/SCheckBox.h"
#include "Widgets/Layout/SScrollBox.h"
#include "Widgets/Text/STextBlock.h"
#include "Widgets/Layout/SBorder.h"
#include "Widgets/SBoxPanel.h"
#include "Engine/GameInstance.h"
#include "Editor.h"

#define LOCTEXT_NAMESPACE "GlitchCodeAIPanel"

void SGlitchCodeAIPanel::Construct(const FArguments& InArgs)
{
	// Get subsystem
	UGameInstance* GameInstance = nullptr;
	if (GEditor)
	{
		UWorld* EditorWorld = GEditor->GetEditorWorldContext().World();
		if (EditorWorld)
		{
			GameInstance = EditorWorld->GetGameInstance();
		}
	}

	if (GameInstance)
	{
		CachedSubsystem = GameInstance->GetSubsystem<UGlitchCodeAISubsystem>();
	}

	if (CachedSubsystem)
	{
		CachedSubsystem->OnResponseReceived.AddDynamic(this, &SGlitchCodeAIPanel::OnResponseReceived);
		CachedSubsystem->OnErrorReceived.AddDynamic(this, &SGlitchCodeAIPanel::OnErrorReceived);
		CachedSubsystem->OnConnectionStateChanged.AddDynamic(this, &SGlitchCodeAIPanel::OnConnectionStateChanged);
		bIsConnected = CachedSubsystem->IsRunning();
	}

	ChildSlot
	[
		SNew(SVerticalBox)

		// Header with connection indicator and settings button
		+ SVerticalBox::Slot()
		.AutoHeight()
		.Padding(8.0f)
		[
			SNew(SBorder)
			.BorderImage(FAppStyle::GetBrush("ToolPanel.GroupBorder"))
			.Padding(FMargin(8.0f, 6.0f))
			[
				SNew(SHorizontalBox)

				// Title
				+ SHorizontalBox::Slot()
				.FillWidth(1.0f)
				.VAlign(VAlign_Center)
				[
					SNew(STextBlock)
					.Text(LOCTEXT("HeaderTitle", "GlitchCode AI"))
					.Font(FCoreStyle::GetDefaultFontStyle("Bold", 14))
					.ColorAndOpacity(FLinearColor(1.0f, 0.5f, 0.0f))
				]

				// Connection status
				+ SHorizontalBox::Slot()
				.AutoWidth()
				.VAlign(VAlign_Center)
				.Padding(0, 0, 8, 0)
				[
					SNew(SHorizontalBox)

					+ SHorizontalBox::Slot()
					.AutoWidth()
					.VAlign(VAlign_Center)
					.Padding(0, 0, 4, 0)
					[
						SAssignNew(ConnectionIndicatorDot, STextBlock)
						.Text(FText::FromString(TEXT("\u25CF")))  // Filled circle
						.Font(FCoreStyle::GetDefaultFontStyle("Regular", 12))
						.ColorAndOpacity(bIsConnected
							? FLinearColor(0.0f, 0.9f, 0.0f)
							: FLinearColor(0.9f, 0.1f, 0.1f))
					]

					+ SHorizontalBox::Slot()
					.AutoWidth()
					.VAlign(VAlign_Center)
					[
						SAssignNew(ConnectionIndicatorText, STextBlock)
						.Text(bIsConnected
							? LOCTEXT("Connected", "Connected")
							: LOCTEXT("Disconnected", "Disconnected"))
						.Font(FCoreStyle::GetDefaultFontStyle("Regular", 9))
						.ColorAndOpacity(bIsConnected
							? FLinearColor(0.0f, 0.8f, 0.0f)
							: FLinearColor(0.8f, 0.2f, 0.2f))
					]
				]

				// Settings toggle button
				+ SHorizontalBox::Slot()
				.AutoWidth()
				.VAlign(VAlign_Center)
				[
					SNew(SButton)
					.Text(LOCTEXT("SettingsBtn", "Settings"))
					.OnClicked(this, &SGlitchCodeAIPanel::OnToggleSettings)
					.ButtonStyle(FAppStyle::Get(), "FlatButton")
				]
			]
		]

		// Settings panel (collapsed by default)
		+ SVerticalBox::Slot()
		.AutoHeight()
		.Padding(4.0f, 0.0f)
		[
			SAssignNew(SettingsContainer, SVerticalBox)
			.Visibility(EVisibility::Collapsed)
			[
				SNew(SBorder)
				.BorderImage(FAppStyle::GetBrush("ToolPanel.GroupBorder"))
				.Padding(8.0f)
				[
					SNew(SVerticalBox)

					+ SVerticalBox::Slot()
					.AutoHeight()
					.Padding(0, 0, 0, 8)
					[
						SNew(STextBlock)
						.Text(LOCTEXT("SettingsTitle", "Settings"))
						.Font(FCoreStyle::GetDefaultFontStyle("Bold", 11))
						.ColorAndOpacity(FLinearColor(1.0f, 0.5f, 0.0f))
					]

					// Auto-start
					+ SVerticalBox::Slot()
					.AutoHeight()
					.Padding(0, 0, 0, 6)
					[
						SNew(SHorizontalBox)

						+ SHorizontalBox::Slot()
						.FillWidth(1.0f)
						.VAlign(VAlign_Center)
						[
							SNew(STextBlock)
							.Text(LOCTEXT("AutoStartLabel", "Auto-start CLI on editor launch"))
						]

						+ SHorizontalBox::Slot()
						.AutoWidth()
						[
							SAssignNew(AutoStartCheckBox, SCheckBox)
							.IsChecked(CachedSubsystem && CachedSubsystem->GetAutoStart()
								? ECheckBoxState::Checked
								: ECheckBoxState::Unchecked)
							.OnCheckStateChanged(this, &SGlitchCodeAIPanel::OnAutoStartChanged)
						]
					]

					// Binary path
					+ SVerticalBox::Slot()
					.AutoHeight()
					.Padding(0, 0, 0, 4)
					[
						SNew(STextBlock)
						.Text(LOCTEXT("BinaryPathLabel", "Custom binary path (leave empty for auto-detect)"))
					]

					+ SVerticalBox::Slot()
					.AutoHeight()
					.Padding(0, 0, 0, 8)
					[
						SAssignNew(BinaryPathTextBox, SEditableTextBox)
						.HintText(LOCTEXT("BinaryPathHint", "e.g. C:/Program Files/GlitchCode/glitch-cli.exe"))
						.Text(FText::FromString(
							CachedSubsystem ? CachedSubsystem->GetBinaryPath() : FString()))
						.OnTextCommitted(this, &SGlitchCodeAIPanel::OnBinaryPathChanged)
					]

					// Restart button
					+ SVerticalBox::Slot()
					.AutoHeight()
					[
						SNew(SButton)
						.Text(LOCTEXT("RestartBtn", "Restart CLI"))
						.OnClicked(this, &SGlitchCodeAIPanel::OnRestartClicked)
						.ButtonStyle(FAppStyle::Get(), "FlatButton.Warning")
					]
				]
			]
		]

		// Chat messages
		+ SVerticalBox::Slot()
		.FillHeight(1.0f)
		.Padding(4.0f)
		[
			SAssignNew(ChatScrollBox, SScrollBox)
			.ScrollBarAlwaysVisible(true)
			[
				SAssignNew(MessageListView, SListView<TSharedPtr<FChatMessage>>)
				.ListItemsSource(&Messages)
				.OnGenerateRow_Lambda([](TSharedPtr<FChatMessage> Item, const TSharedRef<STableViewBase>& OwnerTable)
				{
					TSharedPtr<STableRow<TSharedPtr<FChatMessage>>> Row =
						SNew(STableRow<TSharedPtr<FChatMessage>>, OwnerTable)
						.Padding(FMargin(4.0f));

					Row->SetContent(
						SNew(SVerticalBox)

						+ SVerticalBox::Slot()
						.AutoHeight()
						[
							SNew(STextBlock)
							.Text(FText::FromString(FString::Printf(TEXT("%s - %s"),
								*Item->Sender,
								*Item->Timestamp.ToString(TEXT("%H:%M:%S")))))
							.Font(FCoreStyle::GetDefaultFontStyle("Bold", 9))
							.ColorAndOpacity(Item->bIsUser
								? FLinearColor(0.4f, 0.8f, 1.0f)
								: FLinearColor(1.0f, 0.5f, 0.0f))
						]

						+ SVerticalBox::Slot()
						.AutoHeight()
						.Padding(0, 2.0f, 0, 0)
						[
							SNew(STextBlock)
							.Text(FText::FromString(Item->Content))
							.Font(FCoreStyle::GetDefaultFontStyle("Regular", 11))
							.AutoWrapText(true)
							.ColorAndOpacity(FLinearColor(0.9f, 0.9f, 0.9f))
						]
					);

					return Row;
				})
			]
		]

		// Input area
		+ SVerticalBox::Slot()
		.AutoHeight()
		.Padding(4.0f)
		[
			SNew(SBorder)
			.BorderImage(FAppStyle::GetBrush("ToolPanel.GroupBorder"))
			.Padding(4.0f)
			[
				SNew(SHorizontalBox)

				+ SHorizontalBox::Slot()
				.FillWidth(1.0f)
				[
					SAssignNew(InputTextBox, SEditableTextBox)
					.HintText(LOCTEXT("InputHint", "Type your message..."))
					.OnTextCommitted(this, &SGlitchCodeAIPanel::OnTextCommitted)
				]

				+ SHorizontalBox::Slot()
				.AutoWidth()
				.Padding(4.0f, 0.0f)
				[
					SNew(SButton)
					.Text(LOCTEXT("SendButton", "Send"))
					.OnClicked(this, &SGlitchCodeAIPanel::OnSendClicked)
					.ButtonStyle(FAppStyle::Get(), "FlatButton.Success")
				]
			]
		]
	];

	AddMessage(TEXT("System"), TEXT("GlitchCode AI ready."), false);
}

// --- Connection indicator ---

void SGlitchCodeAIPanel::OnConnectionStateChanged(bool bConnected)
{
	bIsConnected = bConnected;
	RefreshConnectionIndicator();
}

void SGlitchCodeAIPanel::RefreshConnectionIndicator()
{
	if (ConnectionIndicatorDot.IsValid())
	{
		ConnectionIndicatorDot->SetColorAndOpacity(
			bIsConnected
				? FLinearColor(0.0f, 0.9f, 0.0f)
				: FLinearColor(0.9f, 0.1f, 0.1f));
	}

	if (ConnectionIndicatorText.IsValid())
	{
		ConnectionIndicatorText->SetText(
			bIsConnected
				? LOCTEXT("Connected", "Connected")
				: LOCTEXT("Disconnected", "Disconnected"));
		ConnectionIndicatorText->SetColorAndOpacity(
			bIsConnected
				? FLinearColor(0.0f, 0.8f, 0.0f)
				: FLinearColor(0.8f, 0.2f, 0.2f));
	}
}

// --- Settings ---

FReply SGlitchCodeAIPanel::OnToggleSettings()
{
	bSettingsVisible = !bSettingsVisible;

	if (SettingsContainer.IsValid())
	{
		SettingsContainer->SetVisibility(
			bSettingsVisible ? EVisibility::Visible : EVisibility::Collapsed);
	}

	return FReply::Handled();
}

void SGlitchCodeAIPanel::OnAutoStartChanged(ECheckBoxState NewState)
{
	if (CachedSubsystem)
	{
		CachedSubsystem->SetAutoStart(NewState == ECheckBoxState::Checked);
	}
}

void SGlitchCodeAIPanel::OnBinaryPathChanged(const FText& NewText, ETextCommit::Type CommitType)
{
	if (CachedSubsystem)
	{
		CachedSubsystem->SetBinaryPath(NewText.ToString());
	}
}

FReply SGlitchCodeAIPanel::OnRestartClicked()
{
	if (CachedSubsystem)
	{
		AddMessage(TEXT("System"), TEXT("Restarting CLI..."), false);
		CachedSubsystem->RestartCLI();
	}
	return FReply::Handled();
}

// --- Chat ---

void SGlitchCodeAIPanel::OnSendClicked()
{
	if (!InputTextBox.IsValid())
	{
		return;
	}

	const FText Text = InputTextBox->GetText();
	if (Text.IsEmpty())
	{
		return;
	}

	OnTextCommitted(Text, ETextCommit::OnEnter);
}

void SGlitchCodeAIPanel::OnTextCommitted(const FText& Text, ETextCommit::Type CommitType)
{
	if (CommitType != ETextCommit::OnEnter)
	{
		return;
	}

	const FString Message = Text.ToString().TrimStartAndEnd();
	if (Message.IsEmpty())
	{
		return;
	}

	AddMessage(TEXT("You"), Message, true);
	InputTextBox->SetText(FText::GetEmpty());

	if (CachedSubsystem)
	{
		if (!CachedSubsystem->IsRunning())
		{
			CachedSubsystem->StartCLI();
		}
		CachedSubsystem->SendMessage(Message);
	}
}

void SGlitchCodeAIPanel::OnResponseReceived(const FString& Response)
{
	AddMessage(TEXT("GlitchCode"), Response, false);
}

void SGlitchCodeAIPanel::OnErrorReceived(const FString& ErrorMessage)
{
	AddMessage(TEXT("Error"), ErrorMessage, false);
}

void SGlitchCodeAIPanel::AddMessage(const FString& Sender, const FString& Content, bool bIsUser)
{
	TSharedPtr<FChatMessage> NewMessage = MakeShareable(new FChatMessage(Sender, Content, bIsUser));
	Messages.Add(NewMessage);

	if (MessageListView.IsValid())
	{
		MessageListView->RequestListRefresh();
	}

	ScrollToBottom();
}

void SGlitchCodeAIPanel::ScrollToBottom()
{
	if (ChatScrollBox.IsValid())
	{
		ChatScrollBox->ScrollToEnd();
	}
}

#undef LOCTEXT_NAMESPACE
