package com.example.sns.util;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * 관리자 화면에 찍는 절대 시각.
 *
 * 관리자 화면은 정지 근거를 확인하는 곳이라 "3일 전" 같은 상대 시간 대신 정확한 시각을 보여 준다.
 * 정지 유저 목록과 님의 콘텐츠 화면이 같은 모양이어야 해서 형식을 여기 한 곳에 둔다.
 * 초 아래는 판단에 쓰이지 않아 분까지만 찍는다.
 * 템플릿에서는 ${T(com.example.sns.util.DateTimeDisplay).minutes(시각)}으로 부른다.
 */
public final class DateTimeDisplay {

    private static final DateTimeFormatter MINUTES = DateTimeFormatter.ofPattern("yyyy/MM/dd HH:mm");

    private DateTimeDisplay() {
    }

    public static String minutes(LocalDateTime time) {
        return time.format(MINUTES);
    }
}
