#include "UHealingSystem.h"
#include "UHealthComponent.h"
#include "UDamageSystem.h"
#include "GameFramework/Character.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Kismet/GameplayStatics.h"
#include "Sound/SoundCue.h"
#include "Particles/ParticleSystemComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Materials/MaterialInstanceDynamic.h"

UHealingSystem::UHealingSystem()
{
    PrimaryComponentTick.bCanEverTick = true;
}

void UHealingSystem::BeginPlay()
{
    Super::BeginPlay();
}

void UHealingSystem::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

    if (bBandageActive)
    {
        TickBandage(DeltaTime);
    }

    // Passive healing
    if (PassiveHealRate > 0.0f)
    {
        AActor* Owner = GetOwner();
        if (Owner)
        {
            UHealthComponent* Health = Owner->FindComponentByClass<UHealthComponent>();
            if (Health && !Health->IsDead() && Health->GetHealth() < Health->GetMaxHealth())
            {
                float HealAmount = PassiveHealRate * DeltaTime;
                Health->Heal(HealAmount);
            }
        }
    }
}

bool UHealingSystem::Apply(AActor* Target, float HealAmount)
{
    if (!Target || HealAmount <= 0.0f) return false;

    UHealthComponent* Health = Target->FindComponentByClass<UHealthComponent>();
    if (!Health || Health->IsDead()) return false;

    float OldHealth = Health->GetHealth();
    Health->Heal(HealAmount);
    float ActualHeal = Health->GetHealth() - OldHealth;

    if (ActualHeal > 0.0f)
    {
        OnHealingApplied.Broadcast(ActualHeal, Target);
        SpawnHealEffects(Target);
        return true;
    }
    return false;
}

void UHealingSystem::Bandage(AActor* Target, float HealPerTick, float TickInterval, float Duration)
{
    if (!Target || HealPerTick <= 0.0f || Duration <= 0.0f) return;

    BandageTarget = Target;
    BandageHealPerTick = FMath::Min(HealPerTick, MaxBandageHealPerTick);
    BandageTickInterval = FMath::Max(0.1f, TickInterval);
    BandageTimeRemaining = Duration;
    BandageTickTimer = 0.0f;
    bBandageActive = true;
}

void UHealingSystem::CancelBandage()
{
    bBandageActive = false;
    BandageTarget = nullptr;
    BandageTimeRemaining = 0.0f;
    BandageTickTimer = 0.0f;
}

bool UHealingSystem::Potion(AActor* Target, float HealAmount)
{
    if (!Target || HealAmount <= 0.0f) return false;

    UHealthComponent* Health = Target->FindComponentByClass<UHealthComponent>();
    if (!Health || Health->IsDead()) return false;

    float OldHealth = Health->GetHealth();
    Health->Heal(HealAmount);
    float ActualHeal = Health->GetHealth() - OldHealth;

    if (ActualHeal > 0.0f)
    {
        OnHealingApplied.Broadcast(ActualHeal, Target);

        // Spawn heal particle effect
        SpawnHealEffects(Target);

        // Apply visual potion glow effect on the character's mesh
        ACharacter* TargetChar = Cast<ACharacter>(Target);
        if (TargetChar)
        {
            ApplyPotionVisualEffect(TargetChar);
        }

        // Play heal sound
        if (HealSound)
        {
            UGameplayStatics::PlaySoundAtLocation(
                this,
                HealSound,
                Target->GetActorLocation()
            );
        }

        return true;
    }
    return false;
}

bool UHealingSystem::Revive(AActor* Target, float ReviveHealthPercent)
{
    if (!Target) return false;

    UHealthComponent* Health = Target->FindComponentByClass<UHealthComponent>();
    if (!Health || !Health->IsDead()) return false;

    // Set health to the revive percentage
    float ReviveHealth = Health->GetMaxHealth() * FMath::Clamp(ReviveHealthPercent, 0.01f, 1.0f);
    Health->SetHealth(ReviveHealth);

    // Re-enable input for the revived character
    ACharacter* TargetChar = Cast<ACharacter>(Target);
    if (TargetChar)
    {
        AController* Controller = TargetChar->GetController();
        if (Controller)
        {
            APlayerController* PC = Cast<APlayerController>(Controller);
            if (PC)
            {
                PC->EnableInput(PC);
            }
        }

        // Disable ragdoll physics — restore normal collision
        USkeletalMeshComponent* Mesh = TargetChar->GetMesh();
        if (Mesh)
        {
            Mesh->SetSimulatePhysics(false);
            Mesh->SetCollisionProfileName(TEXT("CharacterMesh"));
            Mesh->SetAllBodiesSimulatePhysics(false);
        }

        // Restore movement
        UCharacterMovementComponent* Movement = TargetChar->GetCharacterMovement();
        if (Movement)
        {
            Movement->SetMovementMode(MOVE_Walking);
            Movement->MaxWalkSpeed = 400.0f;
        }
    }

    OnRevived.Broadcast(Target);
    SpawnHealEffects(Target);

    if (HealSound)
    {
        UGameplayStatics::PlaySoundAtLocation(
            this,
            HealSound,
            Target->GetActorLocation()
        );
    }

    return true;
}

bool UHealingSystem::Cleanse(AActor* Target)
{
    if (!Target) return false;

    // Find and cancel DoT on the target's UDamageSystem
    UDamageSystem* DamageSys = Target->FindComponentByClass<UDamageSystem>();
    if (DamageSys)
    {
        DamageSys->CancelDoT();
    }

    // Also cleanse on this actor's damage system if it's the owner
    UDamageSystem* OwnDamageSys = GetOwner()->FindComponentByClass<UDamageSystem>();
    if (OwnDamageSys && OwnDamageSys != DamageSys)
    {
        OwnDamageSys->CancelDoT();
    }

    return true;
}

void UHealingSystem::SetRate(float NewRate)
{
    PassiveHealRate = FMath::Max(0.0f, NewRate);
}

void UHealingSystem::TickBandage(float DeltaTime)
{
    if (!bBandageActive || !BandageTarget) return;

    BandageTimeRemaining -= DeltaTime;
    BandageTickTimer += DeltaTime;

    if (BandageTickTimer >= BandageTickInterval)
    {
        BandageTickTimer -= BandageTickInterval;

        UHealthComponent* Health = BandageTarget->FindComponentByClass<UHealthComponent>();
        if (Health && !Health->IsDead() && Health->GetHealth() < Health->GetMaxHealth())
        {
            float OldHealth = Health->GetHealth();
            Health->Heal(BandageHealPerTick);
            float ActualHeal = Health->GetHealth() - OldHealth;

            if (ActualHeal > 0.0f)
            {
                OnHealingApplied.Broadcast(ActualHeal, BandageTarget);
            }
        }
    }

    if (BandageTimeRemaining <= 0.0f)
    {
        bBandageActive = false;
        BandageTarget = nullptr;
    }
}

void UHealingSystem::SpawnHealEffects(AActor* Target)
{
    if (!Target) return;

    // Spawn heal particle
    if (HealParticle)
    {
        UGameplayStatics::SpawnEmitterAtLocation(
            this,
            HealParticle,
            Target->GetActorLocation(),
            FRotator::ZeroRotator,
            true,
            EPSCPoolMethod::AutoRelease
        );
    }

    // Play heal sound
    if (HealSound)
    {
        UGameplayStatics::PlaySoundAtLocation(
            this,
            HealSound,
            Target->GetActorLocation()
        );
    }
}

void UHealingSystem::ApplyPotionVisualEffect(ACharacter* TargetChar)
{
    if (!TargetChar) return;

    USkeletalMeshComponent* Mesh = TargetChar->GetMesh();
    if (!Mesh) return;

    // Create a dynamic material instance for the heal glow effect
    UMaterialInstanceDynamic* DynMat = Mesh->CreateDynamicMaterialInstance(0);
    if (DynMat)
    {
        // Set a heal glow color (green tint)
        DynMat->SetVectorParameterValue(
            FName("EmissiveColor"),
            FLinearColor(0.0f, PotionVisualIntensity * 0.5f, 0.0f, 1.0f)
        );
    }
}
