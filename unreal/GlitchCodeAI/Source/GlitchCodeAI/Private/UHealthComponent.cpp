#include "UHealthComponent.h"
#include "GameFramework/Character.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/PlayerController.h"
#include "Kismet/GameplayStatics.h"
#include "Sound/SoundCue.h"
#include "Camera/CameraShakeBase.h"
#include "Components/SkeletalMeshComponent.h"

UHealthComponent::UHealthComponent()
{
    PrimaryComponentTick.bCanEverTick = true;
    CurrentHealth = MaxHealth;
}

void UHealthComponent::BeginPlay()
{
    Super::BeginPlay();
    CurrentHealth = FMath::Clamp(CurrentHealth, 0.0f, MaxHealth);
}

void UHealthComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

    if (bIsDead) return;

    if (RegenRate > 0.0f && CurrentHealth < MaxHealth)
    {
        RegenAccumulator += DeltaTime;
        if (RegenAccumulator >= 1.0f)
        {
            float RegenAmount = RegenRate * RegenAccumulator;
            RegenAccumulator = 0.0f;

            float OldHealth = CurrentHealth;
            CurrentHealth = FMath::Min(CurrentHealth + RegenAmount, MaxHealth);
            if (CurrentHealth != OldHealth)
            {
                OnHealthChanged.Broadcast(CurrentHealth, CurrentHealth - OldHealth);
            }
        }
    }
}

void UHealthComponent::Damage(float Amount, const FString& Type)
{
    if (Amount <= 0.0f || bIsDead) return;

    float OldHealth = CurrentHealth;
    CurrentHealth = FMath::Clamp(CurrentHealth - Amount, 0.0f, MaxHealth);
    float Delta = CurrentHealth - OldHealth;

    OnHealthChanged.Broadcast(CurrentHealth, Delta);
    OnDamageReceived.Broadcast(Amount);

    // Play hit sound
    if (DamageSound)
    {
        UGameplayStatics::PlaySoundAtLocation(
            this,
            DamageSound,
            GetOwner()->GetActorLocation()
        );
    }

    // Camera shake for the owning player
    APlayerController* PC = GetOwningPlayerController();
    if (PC && DamageCameraShake)
    {
        PC->ClientStartCameraShake(DamageCameraShake, CameraShakeScale);
    }

    // Apply impulse to nearby physics objects
    ApplyDamageImpulseToNearby(GetOwner()->GetActorLocation());

    // Play VFX / hit effects
    PlayDamageEffects(GetOwner()->GetActorLocation());

    if (CurrentHealth <= 0.0f && !bIsDead)
    {
        HandleDeath();
    }
}

void UHealthComponent::Heal(float Amount)
{
    if (Amount <= 0.0f || bIsDead) return;

    float OldHealth = CurrentHealth;
    CurrentHealth = FMath::Clamp(CurrentHealth + Amount, 0.0f, MaxHealth);
    float Delta = CurrentHealth - OldHealth;

    if (Delta > 0.0f)
    {
        OnHealthChanged.Broadcast(CurrentHealth, Delta);

        if (HealSound)
        {
            UGameplayStatics::PlaySoundAtLocation(
                this,
                HealSound,
                GetOwner()->GetActorLocation()
            );
        }
    }
}

void UHealthComponent::SetHealth(float Value)
{
    float OldHealth = CurrentHealth;
    CurrentHealth = FMath::Clamp(Value, 0.0f, MaxHealth);
    OnHealthChanged.Broadcast(CurrentHealth, CurrentHealth - OldHealth);

    if (CurrentHealth <= 0.0f && !bIsDead)
    {
        HandleDeath();
    }
}

void UHealthComponent::SetMaxHealth(float Value)
{
    MaxHealth = FMath::Max(1.0f, Value);
    CurrentHealth = FMath::Clamp(CurrentHealth, 0.0f, MaxHealth);
}

void UHealthComponent::SetRegenRate(float Rate)
{
    RegenRate = FMath::Max(0.0f, Rate);
    RegenAccumulator = 0.0f;
}

ACharacter* UHealthComponent::GetOwningCharacter() const
{
    return Cast<ACharacter>(GetOwner());
}

APlayerController* UHealthComponent::GetOwningPlayerController() const
{
    ACharacter* Character = GetOwningCharacter();
    if (Character)
    {
        return Cast<APlayerController>(Character->GetController());
    }
    return nullptr;
}

void UHealthComponent::HandleDeath()
{
    bIsDead = true;
    OnDeath.Broadcast();

    // Play death sound
    if (DeathSound)
    {
        UGameplayStatics::PlaySoundAtLocation(
            this,
            DeathSound,
            GetOwner()->GetActorLocation()
        );
    }

    ACharacter* Character = GetOwningCharacter();
    if (Character)
    {
        // Disable player input
        AController* Controller = Character->GetController();
        if (Controller)
        {
            APlayerController* PC = Cast<APlayerController>(Controller);
            if (PC)
            {
                PC->DisableInput(PC);
            }
        }

        // Enable ragdoll physics for death
        USkeletalMeshComponent* Mesh = Character->GetMesh();
        if (Mesh)
        {
            Mesh->SetSimulatePhysics(true);
            Mesh->SetCollisionProfileName(TEXT("Ragdoll"));
            Mesh->SetAllBodiesBelowSimulatePhysics(FName("pelvis"), true, true);
        }
    }
}

void UHealthComponent::PlayDamageEffects(const FVector& HitLocation)
{
    // Apply a physical impulse to the character's mesh from the damage direction
    ACharacter* Character = GetOwningCharacter();
    if (Character)
    {
        USkeletalMeshComponent* Mesh = Character->GetMesh();
        if (Mesh && Mesh->IsSimulatingPhysics())
        {
            FVector ImpulseDir = Character->GetActorLocation() - HitLocation;
            ImpulseDir.Normalize();
            Mesh->AddImpulse(ImpulseDir * DamageImpulseForce);
        }
    }
}

void UHealthComponent::ApplyDamageImpulseToNearby(const FVector& Origin)
{
    TArray<FHitResult> HitResults;
    TArray<AActor*> IgnoreActors;
    if (GetOwner())
    {
        IgnoreActors.Add(GetOwner());
    }

    UKismetSystemLibrary::SphereTraceMulti(
        this,
        Origin,
        Origin,
        DamageRadius,
        ETraceTypeQuery::TraceTypeQuery1,
        false,
        IgnoreActors,
        EDrawDebugTrace::None,
        HitResults,
        true
    );

    for (const FHitResult& Hit : HitResults)
    {
        if (UPrimitiveComponent* Comp = Hit.GetComponent())
        {
            if (Comp->IsSimulatingPhysics())
            {
                FVector ImpulseDir = Comp->GetComponentLocation() - Origin;
                ImpulseDir.Normalize();
                float Distance = FVector::Dist(Origin, Comp->GetComponentLocation());
                float Falloff = FMath::Clamp(1.0f - (Distance / DamageRadius), 0.0f, 1.0f);
                Comp->AddImpulse(ImpulseDir * DamageImpulseForce * Falloff);
            }
        }
    }
}
