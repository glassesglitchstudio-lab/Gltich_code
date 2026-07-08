#include "GlitchCodeAIPanel.h"
#include "GlitchCodeAI.h"
#include "UGlitchCodeAISubsystem.h"
#include "Widgets/Input/SButton.h"
#include "Widgets/Input/SEditableTextBox.h"
#include "Widgets/Layout/SScrollBox.h"
#include "Widgets/Layout/SScrollBar.h"
#include "Widgets/Text/STextBlock.h"
#include "Widgets/Layout/SBorder.h"
#include "Widgets/Layout/SSpacer.h"
#include "Widgets/SBoxPanel.h"
#include "GameFramework/PlayerController.h"
#include "Engine/GameInstance.h"
#include "Editor.h"
#include "EditorStyleSet.h"

#define LOCTEXT_NAMESPACE "GlitchCodeAIPanel"

void SGlitchCodeAIPanel::Construct(const FArguments& InArgs)
{
	// Get the subsystem
	UGameInstance* GameInstance = nullptr;
	if (GEditor)
	{
		UWorld* EditorWorld = GEditor->GetEditorWorldContext().World();
		if (EditorWorld)
		{
			GameInstance = EditorWorld->GetGameInstance();
		}
	}

	if (UGlitchCodeAISubsystem* Subsystem = GameInstance->GetSubsystem<UGlitchCodeAISubsystem>())
	{
		Subsystem->OnResponseReceived.AddDynamic(this, &SGlitchCodeAIPanel::OnResponseReceived);
		Subsystem->OnErrorReceived.AddDynamic(this, &SGlitchCodeAIPanel::OnErrorReceived);
	}

	ChildSlot
	[
		SNew(SVerticalBox)

		// Header
		+ SVerticalBox::Slot()
		.AutoHeight()
		.Padding(8.0f)
		[
			SNew(SBorder)
			.BorderImage(FAppStyle::GetBrush("ToolPanel.GroupBorder"))
			.Padding(8.0f)
			[
				SNew(STextBlock)
				.Text(LOCTEXT("HeaderTitle", "GlitchCode AI"))
				.Font(FCoreStyle::GetDefaultFontStyle("Bold", 14))
				.ColorAndOpacity(FLinearColor(1.0f, 0.5f, 0.0f))  // Neon orange
			]
		]

		// Chat history area
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
								*Item->Timestamp.ToString(TEXT("%H:%M:%S"))))
							)
							.Font(FCoreStyle::GetDefaultFontStyle("Bold", 9))
							.ColorAndOpacity(Item->bIsUser
								? FLinearColor(0.4f, 0.8f, 1.0f)   // Blue for user
								: FLinearColor(1.0f, 0.5f, 0.0f))  // Orange for AI
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

	// Add welcome message
	AddMessage(TEXT("System"), TEXT("GlitchCode AI initialized. Type a message to start."), false);
}

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

	// Display user message
	AddMessage(TEXT("You"), Message, true);
	InputTextBox->SetText(FText::GetEmpty());

	// Send to CLI
	if (UGameInstance* GameInstance = nullptr)
	{
		if (GEditor)
		{
			UWorld* EditorWorld = GEditor->GetEditorWorldContext().World();
			if (EditorWorld)
			{
				GameInstance = EditorWorld->GetGameInstance();
			}
		}

		if (UGlitchCodeAISubsystem* Subsystem = GameInstance->GetSubsystem<UGlitchCodeAISubsystem>())
		{
			if (!Subsystem->IsRunning())
			{
				Subsystem->StartCLI();
			}
			Subsystem->SendMessage(Message);
		}
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
